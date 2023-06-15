/**
 * Modern dynamic array higher-order combinators: MAP, REDUCE, SCAN, BYROW, BYCOL, MAKEARRAY.
 */

import { CellValue, PrimitiveValue, TMatrix, TrellisError, coerceToNumber } from "@trellis/core";
import { EvaluationContext, LambdaClosure, invokeClosure } from "@trellis/runtime";
import { FunctionRegistry } from "./registry.js";

function ensureMatrix(val: CellValue): TMatrix {
  if (val instanceof TMatrix) return val;
  return TMatrix.scalar(val as PrimitiveValue);
}

export function registerCombinatorFunctions(reg: FunctionRegistry): void {
  // MAP(array1, [array2], lambda)
  reg.register({
    name: "MAP",
    category: "array",
    minArgs: 2,
    maxArgs: -1,
    description: "Applies a LAMBDA across elements of one or more arrays to form a new array",
    fn: (args: CellValue[], ctx: EvaluationContext): CellValue => {
      const lambdaArg = args[args.length - 1];
      if (!(lambdaArg instanceof LambdaClosure)) {
        return TrellisError.valueError("MAP requires a LAMBDA function as its final argument");
      }
      const closure = lambdaArg as LambdaClosure;
      const arrayArgs = args.slice(0, args.length - 1).map(ensureMatrix);

      const rows = arrayArgs[0]!.rowCount;
      const cols = arrayArgs[0]!.colCount;

      for (const m of arrayArgs) {
        if (m.rowCount !== rows || m.colCount !== cols) {
          return TrellisError.valueError("All array arguments in MAP must share identical dimensions");
        }
      }

      const outData: PrimitiveValue[][] = [];
      for (let r = 0; r < rows; r++) {
        const rowArr: PrimitiveValue[] = [];
        for (let c = 0; c < cols; c++) {
          const callArgs = arrayArgs.map((m) => m.get(r, c));
          const res = invokeClosure(closure, callArgs, ctx);
          rowArr.push(res instanceof TMatrix ? res.get(0, 0) : (res as PrimitiveValue));
        }
        outData.push(rowArr);
      }

      return new TMatrix(outData);
    }
  });

  // REDUCE(initial_value, array, lambda)
  reg.register({
    name: "REDUCE",
    category: "array",
    minArgs: 3,
    maxArgs: 3,
    description: "Reduces an array to an accumulated value by applying a LAMBDA to each element",
    fn: (args: CellValue[], ctx: EvaluationContext): CellValue => {
      let accumulator: CellValue = args[0] ?? null;
      const matrix = ensureMatrix(args[1]!);
      const lambdaArg = args[2]!;

      if (!(lambdaArg instanceof LambdaClosure)) {
        return TrellisError.valueError("REDUCE requires a LAMBDA function as its final argument");
      }
      const closure = lambdaArg as LambdaClosure;

      for (let r = 0; r < matrix.rowCount; r++) {
        for (let c = 0; c < matrix.colCount; c++) {
          const val = matrix.get(r, c);
          accumulator = invokeClosure(closure, [accumulator, val], ctx);
        }
      }

      return accumulator;
    }
  });

  // SCAN(initial_value, array, lambda)
  reg.register({
    name: "SCAN",
    category: "array",
    minArgs: 3,
    maxArgs: 3,
    description: "Scans an array by applying a LAMBDA, returning an array of intermediate accumulated values",
    fn: (args: CellValue[], ctx: EvaluationContext): CellValue => {
      let accumulator: CellValue = args[0] ?? null;
      const matrix = ensureMatrix(args[1]!);
      const lambdaArg = args[2]!;

      if (!(lambdaArg instanceof LambdaClosure)) {
        return TrellisError.valueError("SCAN requires a LAMBDA function as its final argument");
      }
      const closure = lambdaArg as LambdaClosure;

      const outData: PrimitiveValue[][] = [];
      for (let r = 0; r < matrix.rowCount; r++) {
        const rowArr: PrimitiveValue[] = [];
        for (let c = 0; c < matrix.colCount; c++) {
          const val = matrix.get(r, c);
          accumulator = invokeClosure(closure, [accumulator, val], ctx);
          rowArr.push(accumulator instanceof TMatrix ? accumulator.get(0, 0) : (accumulator as PrimitiveValue));
        }
        outData.push(rowArr);
      }

      return new TMatrix(outData);
    }
  });

  // BYROW(array, lambda)
  reg.register({
    name: "BYROW",
    category: "array",
    minArgs: 2,
    maxArgs: 2,
    description: "Applies a LAMBDA to each row of an array and returns an array of the results",
    fn: (args: CellValue[], ctx: EvaluationContext): CellValue => {
      const matrix = ensureMatrix(args[0]!);
      const lambdaArg = args[1]!;

      if (!(lambdaArg instanceof LambdaClosure)) {
        return TrellisError.valueError("BYROW requires a LAMBDA function as its second argument");
      }
      const closure = lambdaArg as LambdaClosure;

      const outData: PrimitiveValue[][] = [];
      for (let r = 0; r < matrix.rowCount; r++) {
        const rowSlice = matrix.slice(r, 0, r, matrix.colCount - 1);
        const res = invokeClosure(closure, [rowSlice], ctx);
        outData.push([res instanceof TMatrix ? res.get(0, 0) : (res as PrimitiveValue)]);
      }

      return new TMatrix(outData);
    }
  });

  // BYCOL(array, lambda)
  reg.register({
    name: "BYCOL",
    category: "array",
    minArgs: 2,
    maxArgs: 2,
    description: "Applies a LAMBDA to each column of an array and returns an array of the results",
    fn: (args: CellValue[], ctx: EvaluationContext): CellValue => {
      const matrix = ensureMatrix(args[0]!);
      const lambdaArg = args[1]!;

      if (!(lambdaArg instanceof LambdaClosure)) {
        return TrellisError.valueError("BYCOL requires a LAMBDA function as its second argument");
      }
      const closure = lambdaArg as LambdaClosure;

      const outRow: PrimitiveValue[] = [];
      for (let c = 0; c < matrix.colCount; c++) {
        const colSlice = matrix.slice(0, c, matrix.rowCount - 1, c);
        const res = invokeClosure(closure, [colSlice], ctx);
        outRow.push(res instanceof TMatrix ? res.get(0, 0) : (res as PrimitiveValue));
      }

      return new TMatrix([outRow]);
    }
  });

  // MAKEARRAY(rows, cols, lambda)
  reg.register({
    name: "MAKEARRAY",
    category: "array",
    minArgs: 3,
    maxArgs: 3,
    description: "Returns a calculated array of specified row and column dimensions by applying a LAMBDA",
    fn: (args: CellValue[], ctx: EvaluationContext): CellValue => {
      const rows = Math.floor(coerceToNumber(args[0]));
      const cols = Math.floor(coerceToNumber(args[1]));
      const lambdaArg = args[2]!;

      if (rows <= 0 || cols <= 0) {
        return TrellisError.valueError("MAKEARRAY dimensions must be positive integers");
      }

      if (!(lambdaArg instanceof LambdaClosure)) {
        return TrellisError.valueError("MAKEARRAY requires a LAMBDA function as its third argument");
      }
      const closure = lambdaArg as LambdaClosure;

      const outData: PrimitiveValue[][] = [];
      for (let r = 1; r <= rows; r++) {
        const rowArr: PrimitiveValue[] = [];
        for (let c = 1; c <= cols; c++) {
          const res = invokeClosure(closure, [r, c], ctx);
          rowArr.push(res instanceof TMatrix ? res.get(0, 0) : (res as PrimitiveValue));
        }
        outData.push(rowArr);
      }

      return new TMatrix(outData);
    }
  });
}
