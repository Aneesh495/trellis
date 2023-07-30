import { benchmark } from "./framework.js";
import { Parser } from "@trellis/parser";
import { BytecodeCompiler, VirtualMachine, SimpleEvaluationContext } from "@trellis/runtime";

const ctx = new SimpleEvaluationContext();

// Pre-compiled chunks for isolated VM execution throughput
const arithAst = Parser.parse("=(10 + 20) * 30 / (4 - 2) ^ 2");
const arithChunk = BytecodeCompiler.compile(arithAst);

const complexAst = Parser.parse("=IF(10 > 5, (100 * 1.05) / (1 + 0.08) ^ 3, 0)");
const complexChunk = BytecodeCompiler.compile(complexAst);

const letAst = Parser.parse("=LET(rev, 1000000, margin, 0.35, capex, 50000, rev * margin - capex)");
const letChunk = BytecodeCompiler.compile(letAst);

benchmark("VM: Arithmetic Dispatch Throughput", () => {
  VirtualMachine.evaluate(arithChunk, ctx);
}, { warmupIterations: 500, minDurationMs: 150 });

benchmark("VM: Conditional Branch Evaluation", () => {
  VirtualMachine.evaluate(complexChunk, ctx);
}, { warmupIterations: 500, minDurationMs: 150 });

benchmark("VM: LET Scope Resolution and Bytecode Execution", () => {
  VirtualMachine.evaluate(letChunk, ctx);
}, { warmupIterations: 500, minDurationMs: 150 });
