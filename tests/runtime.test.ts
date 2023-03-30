import { describe, it, assert, assertEqual } from "./framework.js";
import { Parser } from "@trellis/parser";
import {
  BytecodeCompiler,
  VirtualMachine,
  SimpleEvaluationContext,
  disassembleChunk
} from "../packages/runtime/src/index.js";
import { TMatrix, TrellisError, ErrorCode } from "@trellis/core";

describe("Runtime: Bytecode VM and Evaluation", () => {
  it("compiles and executes simple arithmetic on VM", () => {
    const ast = Parser.parse("10 + 20 * 2");
    const chunk = BytecodeCompiler.compile(ast);
    const ctx = new SimpleEvaluationContext();

    const result = VirtualMachine.evaluate(chunk, ctx);
    assertEqual(result, 50);

    const disasm = disassembleChunk(chunk);
    assert(disasm.includes("OP_CONST"));
    assert(disasm.includes("OP_MUL"));
    assert(disasm.includes("OP_ADD"));
  });

  it("short-circuits conditional branches without evaluating unreached division by zero", () => {
    const ctx = new SimpleEvaluationContext();

    // IF(TRUE, 42, 1 / 0) should return 42 without throwing #DIV/0!
    const astTrue = Parser.parse("IF(TRUE, 42, 1 / 0)");
    const chunkTrue = BytecodeCompiler.compile(astTrue);
    const resultTrue = VirtualMachine.evaluate(chunkTrue, ctx);
    assertEqual(resultTrue, 42);

    // IF(FALSE, 1 / 0, 99) should return 99 without throwing #DIV/0!
    const astFalse = Parser.parse("IF(FALSE, 1 / 0, 99)");
    const chunkFalse = BytecodeCompiler.compile(astFalse);
    const resultFalse = VirtualMachine.evaluate(chunkFalse, ctx);
    assertEqual(resultFalse, 99);
  });

  it("resolves cell references and range values from context", () => {
    const ctx = new SimpleEvaluationContext();
    ctx.setCellValue("A1", 100);
    ctx.setCellValue("B1", 200);

    const ast = Parser.parse("A1 + B1 * 2");
    const chunk = BytecodeCompiler.compile(ast);
    const result = VirtualMachine.evaluate(chunk, ctx);
    assertEqual(result, 500);
  });

  it("evaluates LET expressions with local variables", () => {
    const ctx = new SimpleEvaluationContext();
    const ast = Parser.parse("LET(base, 50, rate, 1.2, base * rate)");
    const chunk = BytecodeCompiler.compile(ast);
    const result = VirtualMachine.evaluate(chunk, ctx);
    assertEqual(result, 60);
  });

  it("evaluates 2D array literals into TMatrix", () => {
    const ctx = new SimpleEvaluationContext();
    const ast = Parser.parse("{10, 20; 30, 40}");
    const chunk = BytecodeCompiler.compile(ast);
    const result = VirtualMachine.evaluate(chunk, ctx);

    assert(result instanceof TMatrix);
    const mat = result as TMatrix;
    assertEqual(mat.rowCount, 2);
    assertEqual(mat.colCount, 2);
    assertEqual(mat.get(0, 0), 10);
    assertEqual(mat.get(1, 1), 40);
  });

  it("propagates errors through arithmetic operators automatically", () => {
    const ctx = new SimpleEvaluationContext();
    ctx.setCellValue("A1", TrellisError.divZero());

    const ast = Parser.parse("A1 + 50");
    const chunk = BytecodeCompiler.compile(ast);
    const result = VirtualMachine.evaluate(chunk, ctx);

    assert(TrellisError.isError(result));
    assertEqual((result as TrellisError).code, ErrorCode.DIV_ZERO);
  });

  it("dispatches function calls to evaluation context", () => {
    const ctx = new SimpleEvaluationContext();
    ctx.registerFunction("DOUBLE", (args) => {
      const n = Number(args[0]);
      return n * 2;
    });

    const ast = Parser.parse("DOUBLE(25) + 10");
    const chunk = BytecodeCompiler.compile(ast);
    const result = VirtualMachine.evaluate(chunk, ctx);
    assertEqual(result, 60);
  });
});
