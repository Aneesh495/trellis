/**
 * High-throughput streaming lexer for formula strings.
 * Generates strongly typed tokens with line, column, and span metadata.
 */

import { Token, TokenType } from "./tokens.js";
import { TrellisError } from "@trellis/core";

export class Lexer {
  private readonly input: string;
  private readonly length: number;
  private pos = 0;
  private line = 1;
  private col = 1;

  constructor(input: string) {
    // Strip leading '=' or '+' if present
    const trimmed = input.trim();
    if (trimmed.startsWith("=") || trimmed.startsWith("+")) {
      this.input = trimmed.slice(1);
    } else {
      this.input = trimmed;
    }
    this.length = this.input.length;
  }

  /**
   * Tokenizes the entire input string into an array of tokens ending with EOF.
   */
  public tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.length) {
      const token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }
    tokens.push(this.createToken(TokenType.EOF, "", "", this.pos, this.pos));
    return tokens;
  }

  private nextToken(): Token | null {
    this.skipWhitespace();
    if (this.pos >= this.length) {
      return null;
    }

    const startPos = this.pos;
    const startCol = this.col;
    const startLine = this.line;
    const ch = this.input[this.pos]!;

    // String literal enclosed in double quotes
    if (ch === '"') {
      return this.readString(startPos, startLine, startCol);
    }

    // Number literal
    if (this.isDigit(ch) || (ch === "." && this.pos + 1 < this.length && this.isDigit(this.input[this.pos + 1]!))) {
      return this.readNumber(startPos, startLine, startCol);
    }

    // Error literal starting with '#'
    if (ch === "#") {
      const errToken = this.tryReadError(startPos, startLine, startCol);
      if (errToken) return errToken;
      // If not an error literal, '#' is the spill reference operator
      this.advance();
      return this.createToken(TokenType.HASH, "#", "#", startPos, this.pos, startLine, startCol);
    }

    // Quoted sheet name reference starting with single quote
    if (ch === "'") {
      return this.readQuotedReference(startPos, startLine, startCol);
    }

    // Structured reference starting with '['
    if (ch === "[") {
      return this.readStructuredReference(startPos, startLine, startCol);
    }

    // Two-character comparison operators
    if (ch === "<") {
      if (this.peek(1) === "=") {
        this.advance(2);
        return this.createToken(TokenType.LESS_THAN_OR_EQUAL, "<=", "<=", startPos, this.pos, startLine, startCol);
      }
      if (this.peek(1) === ">") {
        this.advance(2);
        return this.createToken(TokenType.NOT_EQUAL, "<>", "<>", startPos, this.pos, startLine, startCol);
      }
      this.advance();
      return this.createToken(TokenType.LESS_THAN, "<", "<", startPos, this.pos, startLine, startCol);
    }

    if (ch === ">") {
      if (this.peek(1) === "=") {
        this.advance(2);
        return this.createToken(TokenType.GREATER_THAN_OR_EQUAL, ">=", ">=", startPos, this.pos, startLine, startCol);
      }
      this.advance();
      return this.createToken(TokenType.GREATER_THAN, ">", ">", startPos, this.pos, startLine, startCol);
    }

    // Single-character operators and delimiters
    switch (ch) {
      case "+":
        this.advance();
        return this.createToken(TokenType.PLUS, "+", "+", startPos, this.pos, startLine, startCol);
      case "-":
        this.advance();
        return this.createToken(TokenType.MINUS, "-", "-", startPos, this.pos, startLine, startCol);
      case "*":
        this.advance();
        return this.createToken(TokenType.STAR, "*", "*", startPos, this.pos, startLine, startCol);
      case "/":
        this.advance();
        return this.createToken(TokenType.SLASH, "/", "/", startPos, this.pos, startLine, startCol);
      case "^":
        this.advance();
        return this.createToken(TokenType.CARET, "^", "^", startPos, this.pos, startLine, startCol);
      case "&":
        this.advance();
        return this.createToken(TokenType.AMPERSAND, "&", "&", startPos, this.pos, startLine, startCol);
      case "=":
        this.advance();
        return this.createToken(TokenType.EQUAL, "=", "=", startPos, this.pos, startLine, startCol);
      case "%":
        this.advance();
        return this.createToken(TokenType.PERCENT, "%", "%", startPos, this.pos, startLine, startCol);
      case "(":
        this.advance();
        return this.createToken(TokenType.LPAREN, "(", "(", startPos, this.pos, startLine, startCol);
      case ")":
        this.advance();
        return this.createToken(TokenType.RPAREN, ")", ")", startPos, this.pos, startLine, startCol);
      case "{":
        this.advance();
        return this.createToken(TokenType.LBRACE, "{", "{", startPos, this.pos, startLine, startCol);
      case "}":
        this.advance();
        return this.createToken(TokenType.RBRACE, "}", "}", startPos, this.pos, startLine, startCol);
      case ",":
        this.advance();
        return this.createToken(TokenType.COMMA, ",", ",", startPos, this.pos, startLine, startCol);
      case ";":
        this.advance();
        return this.createToken(TokenType.SEMICOLON, ";", ";", startPos, this.pos, startLine, startCol);
      case ":":
        this.advance();
        return this.createToken(TokenType.COLON, ":", ":", startPos, this.pos, startLine, startCol);
      case "!":
        this.advance();
        return this.createToken(TokenType.EXCLAMATION, "!", "!", startPos, this.pos, startLine, startCol);
    }

    // Identifiers, Cell References, Range References, or Keywords
    if (this.isIdentifierStart(ch) || ch === "$") {
      return this.readIdentifierOrReference(startPos, startLine, startCol);
    }

    throw TrellisError.valueError(`Unexpected character in formula at line ${this.line}, col ${this.col}: '${ch}'`);
  }

  private readString(startPos: number, startLine: number, startCol: number): Token {
    this.advance(); // consume opening quote
    let value = "";
    while (this.pos < this.length) {
      const ch = this.input[this.pos]!;
      if (ch === '"') {
        if (this.pos + 1 < this.length && this.input[this.pos + 1] === '"') {
          // Escaped double quote
          value += '"';
          this.advance(2);
        } else {
          // Closing double quote
          this.advance();
          const raw = this.input.slice(startPos, this.pos);
          return this.createToken(TokenType.STRING, value, raw, startPos, this.pos, startLine, startCol);
        }
      } else {
        value += ch;
        this.advance();
      }
    }
    throw TrellisError.valueError(`Unterminated string literal starting at line ${startLine}, col ${startCol}`);
  }

  private readNumber(startPos: number, startLine: number, startCol: number): Token {
    let seenDot = false;
    while (this.pos < this.length) {
      const ch = this.input[this.pos]!;
      if (this.isDigit(ch)) {
        this.advance();
      } else if (ch === "." && !seenDot) {
        seenDot = true;
        this.advance();
      } else {
        break;
      }
    }

    // Scientific exponent notation (e.g. 1e10, 2.5E-4)
    if (this.pos < this.length && (this.input[this.pos] === "e" || this.input[this.pos] === "E")) {
      const nextChar = this.peek(1);
      if (this.isDigit(nextChar) || nextChar === "+" || nextChar === "-") {
        this.advance(); // consume 'e'
        if (this.input[this.pos] === "+" || this.input[this.pos] === "-") {
          this.advance();
        }
        while (this.pos < this.length && this.isDigit(this.input[this.pos]!)) {
          this.advance();
        }
      }
    }

    const raw = this.input.slice(startPos, this.pos);
    return this.createToken(TokenType.NUMBER, raw, raw, startPos, this.pos, startLine, startCol);
  }

  private tryReadError(startPos: number, startLine: number, startCol: number): Token | null {
    const errorLiterals = [
      "#NULL!",
      "#DIV/0!",
      "#VALUE!",
      "#REF!",
      "#NAME?",
      "#NUM!",
      "#N/A",
      "#SPILL!",
      "#CIRCULAR!",
      "#BLOCKED!",
      "#CALC!"
    ];
    const sub = this.input.slice(startPos).toUpperCase();
    for (const err of errorLiterals) {
      if (sub.startsWith(err)) {
        this.advance(err.length);
        const raw = this.input.slice(startPos, this.pos);
        return this.createToken(TokenType.ERROR, err, raw, startPos, this.pos, startLine, startCol);
      }
    }
    return null;
  }

  private readQuotedReference(startPos: number, startLine: number, startCol: number): Token {
    this.advance(); // consume opening single quote
    let sheetName = "";
    while (this.pos < this.length) {
      const ch = this.input[this.pos]!;
      if (ch === "'") {
        if (this.pos + 1 < this.length && this.input[this.pos + 1] === "'") {
          sheetName += "'";
          this.advance(2);
        } else {
          this.advance(); // consume closing quote
          break;
        }
      } else {
        sheetName += ch;
        this.advance();
      }
    }

    if (this.pos < this.length && this.input[this.pos] === "!") {
      this.advance(); // consume '!'
      // Read cell or range coordinate after exclamation mark
      const coordStart = this.pos;
      while (this.pos < this.length && (this.isAlphaNumeric(this.input[this.pos]!) || this.input[this.pos] === "$" || this.input[this.pos] === ":")) {
        this.advance();
      }
      const coordPart = this.input.slice(coordStart, this.pos);
      const raw = this.input.slice(startPos, this.pos);
      const fullRef = `'${sheetName}'!${coordPart}`;
      const type = coordPart.includes(":") ? TokenType.RANGE_REF : TokenType.CELL_REF;
      return this.createToken(type, fullRef, raw, startPos, this.pos, startLine, startCol);
    }

    throw TrellisError.refError(`Expected '!' after quoted sheet name '${sheetName}' at line ${startLine}, col ${startCol}`);
  }

  private readStructuredReference(startPos: number, startLine: number, startCol: number): Token {
    let bracketDepth = 0;
    while (this.pos < this.length) {
      const ch = this.input[this.pos]!;
      if (ch === "[") bracketDepth++;
      else if (ch === "]") {
        bracketDepth--;
        if (bracketDepth === 0) {
          this.advance();
          break;
        }
      }
      this.advance();
    }
    const raw = this.input.slice(startPos, this.pos);
    return this.createToken(TokenType.STRUCTURED_REF, raw, raw, startPos, this.pos, startLine, startCol);
  }

  private readIdentifierOrReference(startPos: number, startLine: number, startCol: number): Token {
    while (this.pos < this.length) {
      const ch = this.input[this.pos]!;
      if (this.isAlphaNumeric(ch) || ch === "_" || ch === "." || ch === "$") {
        this.advance();
      } else {
        break;
      }
    }

    // Check for sheet reference prefix (e.g. Sheet1!A1)
    if (this.pos < this.length && this.input[this.pos] === "!") {
      this.advance(); // consume '!'
      while (this.pos < this.length && (this.isAlphaNumeric(this.input[this.pos]!) || this.input[this.pos] === "$" || this.input[this.pos] === ":")) {
        this.advance();
      }
      const raw = this.input.slice(startPos, this.pos);
      const isRange = raw.includes(":");
      return this.createToken(isRange ? TokenType.RANGE_REF : TokenType.CELL_REF, raw, raw, startPos, this.pos, startLine, startCol);
    }

    // Check if next token is colon for range reference (e.g. A1:B10)
    if (this.pos < this.length && this.input[this.pos] === ":" && this.peek(1) !== "=") {
      const nextChar = this.peek(1);
      if (this.isAlphaNumeric(nextChar) || nextChar === "$") {
        this.advance(); // consume ':'
        while (this.pos < this.length && (this.isAlphaNumeric(this.input[this.pos]!) || this.input[this.pos] === "$")) {
          this.advance();
        }
        const raw = this.input.slice(startPos, this.pos);
        return this.createToken(TokenType.RANGE_REF, raw, raw, startPos, this.pos, startLine, startCol);
      }
    }

    const raw = this.input.slice(startPos, this.pos);
    const upper = raw.toUpperCase();

    // Check for Boolean constants
    if (upper === "TRUE" || upper === "FALSE") {
      return this.createToken(TokenType.BOOLEAN, upper, raw, startPos, this.pos, startLine, startCol);
    }

    // Check for Keywords
    if (upper === "LAMBDA") {
      return this.createToken(TokenType.LAMBDA, upper, raw, startPos, this.pos, startLine, startCol);
    }
    if (upper === "LET") {
      return this.createToken(TokenType.LET, upper, raw, startPos, this.pos, startLine, startCol);
    }

    // Check if valid Cell Reference (e.g. A1, $B$5, C$10, $D2)
    if (/^\$?[A-Za-z]+\$?[0-9]+$/.test(raw)) {
      return this.createToken(TokenType.CELL_REF, raw, raw, startPos, this.pos, startLine, startCol);
    }

    // Standard Identifier (function name or variable)
    return this.createToken(TokenType.IDENTIFIER, upper, raw, startPos, this.pos, startLine, startCol);
  }

  private skipWhitespace(): void {
    while (this.pos < this.length) {
      const ch = this.input[this.pos]!;
      if (ch === " " || ch === "\t" || ch === "\r") {
        this.advance();
      } else if (ch === "\n") {
        this.line++;
        this.col = 1;
        this.pos++;
      } else {
        break;
      }
    }
  }

  private advance(n = 1): void {
    this.pos += n;
    this.col += n;
  }

  private peek(offset = 0): string {
    const target = this.pos + offset;
    return target < this.length ? this.input[target]! : "";
  }

  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  private isAlpha(ch: string): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
  }

  private isAlphaNumeric(ch: string): boolean {
    return this.isAlpha(ch) || this.isDigit(ch);
  }

  private isIdentifierStart(ch: string): boolean {
    return this.isAlpha(ch) || ch === "_";
  }

  private createToken(
    type: TokenType,
    value: string,
    raw: string,
    start: number,
    end: number,
    line = this.line,
    col = this.col
  ): Token {
    return { type, value, raw, start, end, line, col };
  }
}
