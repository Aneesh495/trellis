/**
 * Recursive descent Pratt parser with operator precedence climbing for Trellis formulas.
 */

import { Token, TokenType } from "./tokens.js";
import { Lexer } from "./lexer.js";
import {
  ASTNode,
  BinaryOp,
  BinaryOpNode,
  UnaryOpNode,
  FunctionCallNode,
  LiteralNode,
  CellNode,
  RangeNode,
  SpillRefNode,
  ArrayLiteralNode,
  LambdaNode,
  LetNode,
  VariableNode
} from "./ast.js";
import { parseCellRef, parseRangeRef, TrellisError } from "@trellis/core";

export class Parser {
  private readonly tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public static parse(input: string): ASTNode {
    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parseExpression(0);
  }

  /**
   * Main Pratt parsing loop with precedence climbing.
   */
  public parseExpression(minPrecedence = 0): ASTNode {
    let left = this.parsePrefix();

    while (this.current < this.tokens.length) {
      // Check for postfix operators (# or %)
      if (this.match(TokenType.HASH)) {
        if (left.type === "Cell") {
          left = {
            type: "SpillRef",
            root: left.coord,
            raw: `${left.raw}#`,
            start: left.start,
            end: this.previous().end
          } as SpillRefNode;
          continue;
        } else {
          throw TrellisError.valueError(`Spill operator '#' must follow a cell reference, found ${left.type}`);
        }
      }

      if (this.match(TokenType.PERCENT)) {
        left = {
          type: "UnaryOp",
          op: "%",
          argument: left,
          isPrefix: false,
          start: left.start,
          end: this.previous().end
        } as UnaryOpNode;
        continue;
      }

      const prec = this.getBinaryPrecedence();
      if (prec < minPrecedence) {
        break;
      }

      const opToken = this.advance();
      const op = this.tokenToBinaryOp(opToken);
      // Right-associative exponentiation (^), left-associative for others
      const nextMinPrec = op === "^" ? prec : prec + 1;
      const right = this.parseExpression(nextMinPrec);

      left = {
        type: "BinaryOp",
        op,
        left,
        right,
        start: left.start,
        end: right.end
      } as BinaryOpNode;
    }

    return left;
  }

  private parsePrefix(): ASTNode {
    // Unary plus or minus (+10, -A1)
    if (this.match(TokenType.PLUS) || this.match(TokenType.MINUS)) {
      const opToken = this.previous();
      const op = opToken.type === TokenType.PLUS ? "+" : "-";
      const arg = this.parseExpression(60); // High precedence for unary prefix
      return {
        type: "UnaryOp",
        op,
        argument: arg,
        isPrefix: true,
        start: opToken.start,
        end: arg.end
      } as UnaryOpNode;
    }

    // Number literal
    if (this.match(TokenType.NUMBER)) {
      const token = this.previous();
      return {
        type: "Literal",
        value: parseFloat(token.value),
        raw: token.raw,
        start: token.start,
        end: token.end
      } as LiteralNode;
    }

    // String literal
    if (this.match(TokenType.STRING)) {
      const token = this.previous();
      return {
        type: "Literal",
        value: token.value,
        raw: token.raw,
        start: token.start,
        end: token.end
      } as LiteralNode;
    }

    // Boolean literal
    if (this.match(TokenType.BOOLEAN)) {
      const token = this.previous();
      return {
        type: "Literal",
        value: token.value === "TRUE",
        raw: token.raw,
        start: token.start,
        end: token.end
      } as LiteralNode;
    }

    // Error literal
    if (this.match(TokenType.ERROR)) {
      const token = this.previous();
      const err = TrellisError.fromString(token.value) || TrellisError.valueError();
      return {
        type: "Literal",
        value: err,
        raw: token.raw,
        start: token.start,
        end: token.end
      } as LiteralNode;
    }

    // Cell reference
    if (this.match(TokenType.CELL_REF)) {
      const token = this.previous();
      const coord = parseCellRef(token.value);
      return {
        type: "Cell",
        coord,
        raw: token.raw,
        start: token.start,
        end: token.end
      } as CellNode;
    }

    // Range reference
    if (this.match(TokenType.RANGE_REF)) {
      const token = this.previous();
      const range = parseRangeRef(token.value);
      return {
        type: "Range",
        range,
        raw: token.raw,
        start: token.start,
        end: token.end
      } as RangeNode;
    }

    // LAMBDA special form
    if (this.match(TokenType.LAMBDA)) {
      return this.parseLambda();
    }

    // LET special form
    if (this.match(TokenType.LET)) {
      return this.parseLet();
    }

    // Function call or variable identifier
    if (this.match(TokenType.IDENTIFIER)) {
      const token = this.previous();
      if (this.match(TokenType.LPAREN)) {
        return this.parseFunctionArgs(token.value, token.start);
      }
      return {
        type: "Variable",
        name: token.value,
        start: token.start,
        end: token.end
      } as VariableNode;
    }

    // Grouping parentheses (expr)
    if (this.match(TokenType.LPAREN)) {
      const expr = this.parseExpression(0);
      this.consume(TokenType.RPAREN, "Expected ')' after grouped expression");
      return expr;
    }

    // Array literal { 1, 2; 3, 4 }
    if (this.match(TokenType.LBRACE)) {
      return this.parseArrayLiteral();
    }

    const currentToken = this.peek();
    throw TrellisError.valueError(
      `Unexpected token '${currentToken.raw}' at line ${currentToken.line}, col ${currentToken.col}`
    );
  }

  private parseFunctionArgs(name: string, startPos: number): FunctionCallNode {
    const args: ASTNode[] = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        if (this.check(TokenType.COMMA) || this.check(TokenType.RPAREN)) {
          // Omitted blank argument e.g. IF(A1,,2)
          args.push({
            type: "Literal",
            value: null,
            raw: "",
            start: this.peek().start,
            end: this.peek().start
          });
        } else {
          args.push(this.parseExpression(0));
        }
      } while (this.match(TokenType.COMMA));
    }
    const endToken = this.consume(TokenType.RPAREN, `Expected ')' to close function call '${name}'`);
    return {
      type: "FunctionCall",
      name: name.toUpperCase(),
      args,
      start: startPos,
      end: endToken.end
    };
  }

  private parseLambda(): LambdaNode {
    const startToken = this.previous();
    this.consume(TokenType.LPAREN, "Expected '(' after LAMBDA");
    const params: string[] = [];
    let body: ASTNode;

    while (true) {
      if (this.check(TokenType.IDENTIFIER)) {
        const idToken = this.advance();
        if (this.match(TokenType.COMMA)) {
          // It is a parameter name
          params.push(idToken.raw);
        } else if (this.check(TokenType.RPAREN)) {
          // Single variable body
          body = {
            type: "Variable",
            name: idToken.raw,
            start: idToken.start,
            end: idToken.end
          };
          this.advance(); // consume ')'
          break;
        } else {
          // It's the beginning of body expression
          this.current--; // step back to parse expression
          body = this.parseExpression(0);
          this.consume(TokenType.RPAREN, "Expected ')' to terminate LAMBDA");
          break;
        }
      } else {
        body = this.parseExpression(0);
        this.consume(TokenType.RPAREN, "Expected ')' to terminate LAMBDA");
        break;
      }
    }

    return {
      type: "Lambda",
      params,
      body,
      start: startToken.start,
      end: this.previous().end
    };
  }

  private parseLet(): LetNode {
    const startToken = this.previous();
    this.consume(TokenType.LPAREN, "Expected '(' after LET");
    const bindings: Array<{ name: string; expr: ASTNode }> = [];
    let body: ASTNode;

    while (true) {
      const nameToken = this.consume(TokenType.IDENTIFIER, "Expected variable name in LET declaration");
      this.consume(TokenType.COMMA, `Expected ',' after variable name '${nameToken.raw}'`);
      const valExpr = this.parseExpression(0);

      if (this.match(TokenType.COMMA)) {
        if (this.check(TokenType.IDENTIFIER) && this.peekNext()?.type === TokenType.COMMA) {
          // More bindings follow
          bindings.push({ name: nameToken.raw, expr: valExpr });
        } else {
          // Final return expression follows
          bindings.push({ name: nameToken.raw, expr: valExpr });
          body = this.parseExpression(0);
          this.consume(TokenType.RPAREN, "Expected ')' to close LET expression");
          break;
        }
      } else {
        throw TrellisError.valueError("Expected ',' separating LET bindings or preceding final expression");
      }
    }

    return {
      type: "Let",
      bindings,
      body,
      start: startToken.start,
      end: this.previous().end
    };
  }

  private parseArrayLiteral(): ArrayLiteralNode {
    const start = this.previous().start;
    const rows: ASTNode[][] = [];
    let currentRow: ASTNode[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      currentRow.push(this.parseExpression(0));
      if (this.match(TokenType.COMMA)) {
        continue;
      } else if (this.match(TokenType.SEMICOLON)) {
        rows.push(currentRow);
        currentRow = [];
      } else {
        break;
      }
    }

    if (currentRow.length > 0) {
      rows.push(currentRow);
    }
    const endToken = this.consume(TokenType.RBRACE, "Expected '}' to close array literal");
    return {
      type: "ArrayLiteral",
      rows,
      start,
      end: endToken.end
    };
  }

  private getBinaryPrecedence(): number {
    const token = this.peek();
    switch (token.type) {
      case TokenType.EQUAL:
      case TokenType.NOT_EQUAL:
      case TokenType.LESS_THAN:
      case TokenType.LESS_THAN_OR_EQUAL:
      case TokenType.GREATER_THAN:
      case TokenType.GREATER_THAN_OR_EQUAL:
        return 10;
      case TokenType.AMPERSAND:
        return 20;
      case TokenType.PLUS:
      case TokenType.MINUS:
        return 30;
      case TokenType.STAR:
      case TokenType.SLASH:
        return 40;
      case TokenType.CARET:
        return 50;
      case TokenType.COLON:
        return 60;
      default:
        return -1;
    }
  }

  private tokenToBinaryOp(token: Token): BinaryOp {
    switch (token.type) {
      case TokenType.PLUS:
        return "+";
      case TokenType.MINUS:
        return "-";
      case TokenType.STAR:
        return "*";
      case TokenType.SLASH:
        return "/";
      case TokenType.CARET:
        return "^";
      case TokenType.AMPERSAND:
        return "&";
      case TokenType.EQUAL:
        return "=";
      case TokenType.NOT_EQUAL:
        return "<>";
      case TokenType.LESS_THAN:
        return "<";
      case TokenType.LESS_THAN_OR_EQUAL:
        return "<=";
      case TokenType.GREATER_THAN:
        return ">";
      case TokenType.GREATER_THAN_OR_EQUAL:
        return ">=";
      case TokenType.COLON:
        return ":";
      default:
        throw TrellisError.valueError(`Token '${token.raw}' is not a valid binary operator`);
    }
  }

  private match(...types: TokenType[]): boolean {
    for (const t of types) {
      if (this.check(t)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current]!;
  }

  private peekNext(): Token | undefined {
    return this.current + 1 < this.tokens.length ? this.tokens[this.current + 1] : undefined;
  }

  private previous(): Token {
    return this.tokens[this.current - 1]!;
  }

  private consume(type: TokenType, errMsg: string): Token {
    if (this.check(type)) return this.advance();
    const token = this.peek();
    throw TrellisError.valueError(`${errMsg} at line ${token.line}, col ${token.col}`);
  }
}
