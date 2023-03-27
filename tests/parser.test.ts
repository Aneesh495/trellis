import { describe, it, assert, assertEqual, assertDeepEqual } from "./framework.js";
import {
  Lexer,
  Parser,
  TokenType,
  decompile,
  extractDependencies,
  lintFormula
} from "../packages/parser/src/index.js";

describe("Parser: Lexer Tokenizer", () => {
  it("tokenizes arithmetic expressions and numbers", () => {
    const lexer = new Lexer("=12 + 3.14 * 1e5");
    const tokens = lexer.tokenize();

    assertEqual(tokens[0]!.type, TokenType.NUMBER);
    assertEqual(tokens[0]!.value, "12");

    assertEqual(tokens[1]!.type, TokenType.PLUS);

    assertEqual(tokens[2]!.type, TokenType.NUMBER);
    assertEqual(tokens[2]!.value, "3.14");

    assertEqual(tokens[3]!.type, TokenType.STAR);

    assertEqual(tokens[4]!.type, TokenType.NUMBER);
    assertEqual(tokens[4]!.value, "1e5");

    assertEqual(tokens[5]!.type, TokenType.EOF);
  });

  it("tokenizes string literals with quote escapes", () => {
    const lexer = new Lexer('="Hello ""World"""');
    const tokens = lexer.tokenize();

    assertEqual(tokens[0]!.type, TokenType.STRING);
    assertEqual(tokens[0]!.value, 'Hello "World"');
  });

  it("tokenizes cell references, ranges, and spill operators", () => {
    const lexer = new Lexer("=$A$1 + Sheet1!B2:D5 + C10#");
    const tokens = lexer.tokenize();

    assertEqual(tokens[0]!.type, TokenType.CELL_REF);
    assertEqual(tokens[0]!.value, "$A$1");

    assertEqual(tokens[1]!.type, TokenType.PLUS);

    assertEqual(tokens[2]!.type, TokenType.RANGE_REF);
    assertEqual(tokens[2]!.value, "Sheet1!B2:D5");

    assertEqual(tokens[3]!.type, TokenType.PLUS);

    assertEqual(tokens[4]!.type, TokenType.CELL_REF);
    assertEqual(tokens[4]!.value, "C10");

    assertEqual(tokens[5]!.type, TokenType.HASH);
  });

  it("tokenizes error literals", () => {
    const lexer = new Lexer("=IF(A1=0, #DIV/0!, #N/A)");
    const tokens = lexer.tokenize();

    const errorTokens = tokens.filter((t) => t.type === TokenType.ERROR);
    assertEqual(errorTokens.length, 2);
    assertEqual(errorTokens[0]!.value, "#DIV/0!");
    assertEqual(errorTokens[1]!.value, "#N/A");
  });
});

describe("Parser: Pratt Precedence Parser", () => {
  it("respects standard arithmetic precedence", () => {
    // 2 + 3 * 4 should be 2 + (3 * 4)
    const ast = Parser.parse("2 + 3 * 4");
    assertEqual(ast.type, "BinaryOp");
    if (ast.type === "BinaryOp") {
      assertEqual(ast.op, "+");
      assertEqual(ast.left.type, "Literal");
      assertEqual(ast.right.type, "BinaryOp");
      if (ast.right.type === "BinaryOp") {
        assertEqual(ast.right.op, "*");
      }
    }
  });

  it("parses right-associative exponentiation", () => {
    // 2 ^ 3 ^ 2 should be 2 ^ (3 ^ 2)
    const ast = Parser.parse("2 ^ 3 ^ 2");
    assertEqual(ast.type, "BinaryOp");
    if (ast.type === "BinaryOp") {
      assertEqual(ast.op, "^");
      assertEqual(ast.left.type, "Literal");
      assertEqual(ast.right.type, "BinaryOp");
      if (ast.right.type === "BinaryOp") {
        assertEqual(ast.right.op, "^");
      }
    }
  });

  it("parses unary prefix and postfix operators", () => {
    const astPrefix = Parser.parse("-A1");
    assertEqual(astPrefix.type, "UnaryOp");
    if (astPrefix.type === "UnaryOp") {
      assertEqual(astPrefix.op, "-");
      assertEqual(astPrefix.isPrefix, true);
    }

    const astPercent = Parser.parse("50%");
    assertEqual(astPercent.type, "UnaryOp");
    if (astPercent.type === "UnaryOp") {
      assertEqual(astPercent.op, "%");
      assertEqual(astPercent.isPrefix, false);
    }

    const astSpill = Parser.parse("A1#");
    assertEqual(astSpill.type, "SpillRef");
    if (astSpill.type === "SpillRef") {
      assertEqual(astSpill.root.col, 0);
      assertEqual(astSpill.root.row, 0);
    }
  });

  it("parses nested function calls and omitted arguments", () => {
    const ast = Parser.parse("IF(A1 > 0, SUM(B1:B10), )");
    assertEqual(ast.type, "FunctionCall");
    if (ast.type === "FunctionCall") {
      assertEqual(ast.name, "IF");
      assertEqual(ast.args.length, 3);
      assertEqual(ast.args[0]!.type, "BinaryOp");
      assertEqual(ast.args[1]!.type, "FunctionCall");
      assertEqual(ast.args[2]!.type, "Literal"); // Omitted argument evaluates to null literal
    }
  });

  it("parses 2D array literals", () => {
    const ast = Parser.parse("{1, 2, 3; 4, 5, 6}");
    assertEqual(ast.type, "ArrayLiteral");
    if (ast.type === "ArrayLiteral") {
      assertEqual(ast.rows.length, 2);
      assertEqual(ast.rows[0]!.length, 3);
      assertEqual(ast.rows[1]!.length, 3);
    }
  });

  it("parses modern LET and LAMBDA expressions", () => {
    const letAst = Parser.parse("LET(x, 10, y, 20, x + y)");
    assertEqual(letAst.type, "Let");
    if (letAst.type === "Let") {
      assertEqual(letAst.bindings.length, 2);
      assertEqual(letAst.bindings[0]!.name, "x");
      assertEqual(letAst.bindings[1]!.name, "y");
      assertEqual(letAst.body.type, "BinaryOp");
    }

    const lambdaAst = Parser.parse("LAMBDA(x, y, x * y)");
    assertEqual(lambdaAst.type, "Lambda");
    if (lambdaAst.type === "Lambda") {
      assertDeepEqual(lambdaAst.params, ["x", "y"]);
      assertEqual(lambdaAst.body.type, "BinaryOp");
    }
  });
});

describe("Parser: Decompiler and Linter", () => {
  it("decompiles AST trees into valid formula strings", () => {
    const formula = "SUM(A1:B10) + 100 * 2";
    const ast = Parser.parse(formula);
    const roundtrip = decompile(ast);
    assert(roundtrip.includes("SUM(A1:B10)"));
    assert(roundtrip.includes("+"));
    assert(roundtrip.includes("100 * 2"));
  });

  it("extracts all dependencies and identifies volatile status", () => {
    const ast = Parser.parse("SUM(A1:B10) + C5 + D1# + NOW()");
    const deps = extractDependencies(ast);

    assertEqual(deps.ranges.length, 1);
    assertEqual(deps.cells.length, 1);
    assertEqual(deps.spillRoots.length, 1);
    assert(deps.isVolatile, "NOW() should mark formula as volatile");
    assert(deps.functionNames.includes("SUM"));
    assert(deps.functionNames.includes("NOW"));
  });

  it("lints unused variables in LET expressions", () => {
    const ast = Parser.parse("LET(x, 10, unusedVar, 20, x * 2)");
    const diagnostics = lintFormula(ast);

    const unusedDiag = diagnostics.find((d) => d.message.includes("unusedVar"));
    assert(unusedDiag !== undefined, "Linter should warn on unused variable 'unusedVar'");
  });
});
