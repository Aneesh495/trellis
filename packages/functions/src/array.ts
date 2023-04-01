/**
 * Modern dynamic array manipulation, sequence generators, and higher-order functional combinators.
 */

import { FunctionRegistry } from "./registry.js";
import { CellValue, PrimitiveValue, TMatrix, TrellisError, coerceToNumber, compareValues } from "@trellis/core";
import { LambdaClosure } from "@trellis/runtime";
import { BytecodeCompiler, VirtualMachine } from "@trellis/runtime";

export function registerArrayFunctions(reg: FunctionRegistry): void {
  // FILTER
  reg.register({
    name: "FILTER",
    category: "array",
    minArgs: 2,
    maxArgs: 3,
    description: "Filters an array based on a boolean condition array",
    fn: (args) => {
      const table = toMatrix(args[0]!);
      const includeArr = toMatrix(args[1]!).flatten();
      const ifEmpty = args.length > 2 ? args[2] : TrellisError.calcError("Empty filter result");

      if (includeArr.length !== table.rowCount) {
        throw TrellisError.valueError("FILTER include array row count must match input array row count");
      }

      const filteredRows: PrimitiveValue[][] = [];
      for (let r = 0; r < table.rowCount; r++) {
        if (Boolean(includeArr[r])) {
          const rowArr: PrimitiveValue[] = [];
          for (let c = 0; c < table.colCount; c++) {
            rowArr.push(table.get(r, c));
          }
          filteredRows.push(rowArr);
        }
      }

      if (filteredRows.length === 0) {
        if (ifEmpty instanceof TrellisError) throw ifEmpty;
        return ifEmpty ?? null;
      }

      return new TMatrix(filteredRows);
    }
  });

  // SORT
  reg.register({
    name: "SORT",
    category: "array",
    minArgs: 1,
    maxArgs: 4,
    description: "Sorts the contents of a range or array",
    fn: (args) => {
      const table = toMatrix(args[0]!);
      const sortIdx = args.length > 1 ? Math.trunc(coerceToNumber(args[1]!)) : 1;
      const sortOrder = args.length > 2 ? Math.trunc(coerceToNumber(args[2]!)) : 1; // 1: asc, -1: desc
      const byCol = args.length > 3 ? Boolean(args[3]) : false;

      if (byCol) {
        // Transpose, sort by rows, transpose back
        const transposed = table.transpose();
        const sorted = sortTableRows(transposed, sortIdx - 1, sortOrder);
        return sorted.transpose();
      }

      return sortTableRows(table, sortIdx - 1, sortOrder);
    }
  });

  // UNIQUE
  reg.register({
    name: "UNIQUE",
    category: "array",
    minArgs: 1,
    maxArgs: 3,
    description: "Returns unique distinct values from a range or array",
    fn: (args) => {
      const table = toMatrix(args[0]!);
      const byCol = args.length > 1 ? Boolean(args[1]) : false;
      const exactlyOnce = args.length > 2 ? Boolean(args[2]) : false;

      const target = byCol ? table.transpose() : table;
      const rowStrings: string[] = [];
      const rowCounts = new Map<string, number>();

      for (let r = 0; r < target.rowCount; r++) {
        const rowData = [];
        for (let c = 0; c < target.colCount; c++) {
          rowData.push(target.get(r, c));
        }
        const key = JSON.stringify(rowData);
        rowStrings.push(key);
        rowCounts.set(key, (rowCounts.get(key) || 0) + 1);
      }

      const seen = new Set<string>();
      const resultRows: PrimitiveValue[][] = [];

      for (let r = 0; r < target.rowCount; r++) {
        const key = rowStrings[r]!;
        const count = rowCounts.get(key) || 0;

        if (exactlyOnce) {
          if (count === 1) {
            const rowArr: PrimitiveValue[] = [];
            for (let c = 0; c < target.colCount; c++) rowArr.push(target.get(r, c));
            resultRows.push(rowArr);
          }
        } else {
          if (!seen.has(key)) {
            seen.add(key);
            const rowArr: PrimitiveValue[] = [];
            for (let c = 0; c < target.colCount; c++) rowArr.push(target.get(r, c));
            resultRows.push(rowArr);
          }
        }
      }

      if (resultRows.length === 0) throw TrellisError.calcError("No unique values found");
      const resMatrix = new TMatrix(resultRows);
      return byCol ? resMatrix.transpose() : resMatrix;
    }
  });

  // SEQUENCE
  reg.register({
    name: "SEQUENCE",
    category: "array",
    minArgs: 1,
    maxArgs: 4,
    description: "Generates an array of sequential numbers",
    fn: (args) => {
      const rows = Math.trunc(coerceToNumber(args[0]!));
      const cols = args.length > 1 ? Math.trunc(coerceToNumber(args[1]!)) : 1;
      const start = args.length > 2 ? coerceToNumber(args[2]!) : 1;
      const step = args.length > 3 ? coerceToNumber(args[3]!) : 1;

      if (rows < 1 || cols < 1) throw TrellisError.valueError("SEQUENCE dimensions must be positive integers");

      const matrixData: PrimitiveValue[][] = [];
      let currentVal = start;

      for (let r = 0; r < rows; r++) {
        const rowArr: PrimitiveValue[] = [];
        for (let c = 0; c < cols; c++) {
          rowArr.push(currentVal);
          currentVal += step;
        }
        matrixData.push(rowArr);
      }

      return new TMatrix(matrixData);
    }
  });

  // RANDARRAY (Volatile)
  reg.register({
    name: "RANDARRAY",
    category: "array",
    minArgs: 0,
    maxArgs: 5,
    isVolatile: true,
    description: "Returns an array of random numbers between min and max bounds",
    fn: (args) => {
      const rows = args.length > 0 ? Math.trunc(coerceToNumber(args[0]!)) : 1;
      const cols = args.length > 1 ? Math.trunc(coerceToNumber(args[1]!)) : 1;
      const min = args.length > 2 ? coerceToNumber(args[2]!) : 0;
      const max = args.length > 3 ? coerceToNumber(args[3]!) : 1;
      const wholeNumber = args.length > 4 ? Boolean(args[4]) : false;

      if (rows < 1 || cols < 1 || min > max) throw TrellisError.valueError();

      const matrixData: PrimitiveValue[][] = [];
      for (let r = 0; r < rows; r++) {
        const rowArr: PrimitiveValue[] = [];
        for (let c = 0; c < cols; c++) {
          let rand = min + Math.random() * (max - min);
          if (wholeNumber) rand = Math.round(rand);
          rowArr.push(rand);
        }
        matrixData.push(rowArr);
      }
      return new TMatrix(matrixData);
    }
  });

  // TOCOL, TOROW
  reg.register({
    name: "TOCOL",
    category: "array",
    minArgs: 1,
    maxArgs: 3,
    description: "Returns the array in a single column",
    fn: (args) => {
      const table = toMatrix(args[0]!);
      const ignore = args.length > 1 ? Math.trunc(coerceToNumber(args[1]!)) : 0;
      const scanByCol = args.length > 2 ? Boolean(args[2]) : false;

      const items = scanTableElements(table, scanByCol);
      const filtered = filterArrayElements(items, ignore);
      return TMatrix.colVector(filtered);
    }
  });

  reg.register({
    name: "TOROW",
    category: "array",
    minArgs: 1,
    maxArgs: 3,
    description: "Returns the array in a single row",
    fn: (args) => {
      const table = toMatrix(args[0]!);
      const ignore = args.length > 1 ? Math.trunc(coerceToNumber(args[1]!)) : 0;
      const scanByCol = args.length > 2 ? Boolean(args[2]) : false;

      const items = scanTableElements(table, scanByCol);
      const filtered = filterArrayElements(items, ignore);
      return TMatrix.rowVector(filtered);
    }
  });

  // MAP (Higher-Order Functional Combinator)
  reg.register({
    name: "MAP",
    category: "array",
    minArgs: 2,
    maxArgs: -1,
    description: "Applies a LAMBDA function to each value in an array returning an array of results",
    fn: (args, ctx) => {
      const lambdaClosure = args[args.length - 1] as unknown as LambdaClosure;
      if (!(lambdaClosure instanceof LambdaClosure)) {
        throw TrellisError.valueError("Final argument of MAP must be a LAMBDA function");
      }

      const inputMatrices = args.slice(0, -1).map(toMatrix);
      const rows = inputMatrices[0]!.rowCount;
      const cols = inputMatrices[0]!.colCount;
      const resultData: PrimitiveValue[][] = [];

      const lambdaChunk = BytecodeCompiler.compile(lambdaClosure.body);

      for (let r = 0; r < rows; r++) {
        const rowArr: PrimitiveValue[] = [];
        for (let c = 0; c < cols; c++) {
          const itemArgs: CellValue[] = inputMatrices.map((m) => m.get(r, c));
          const callScope = lambdaClosure.closureScope.child();
          for (let p = 0; p < lambdaClosure.params.length; p++) {
            callScope.bind(lambdaClosure.params[p]!, itemArgs[p] ?? null);
          }
          const val = VirtualMachine.evaluate(lambdaChunk, ctx, callScope);
          rowArr.push(val as PrimitiveValue);
        }
        resultData.push(rowArr);
      }

      return new TMatrix(resultData);
    }
  });

  // REDUCE (Higher-Order Fold Combinator)
  reg.register({
    name: "REDUCE",
    category: "array",
    minArgs: 3,
    maxArgs: 3,
    description: "Reduces an array to an accumulated value by applying LAMBDA across elements",
    fn: (args, ctx) => {
      let accumulator: CellValue = args[0]!;
      const array = toMatrix(args[1]!).flatten();
      const lambda = args[2] as unknown as LambdaClosure;
      if (!(lambda instanceof LambdaClosure)) {
        throw TrellisError.valueError("Third argument of REDUCE must be a LAMBDA function");
      }

      const lambdaChunk = BytecodeCompiler.compile(lambda.body);

      for (const item of array) {
        const callScope = lambda.closureScope.child();
        callScope.bind(lambda.params[0]!, accumulator);
        callScope.bind(lambda.params[1]!, item);
        accumulator = VirtualMachine.evaluate(lambdaChunk, ctx, callScope);
      }

      return accumulator;
    }
  });
}

function toMatrix(val: CellValue): TMatrix {
  if (val instanceof TMatrix) return val;
  return TMatrix.scalar(val as PrimitiveValue);
}

function sortTableRows(table: TMatrix, colIdx: number, order: number): TMatrix {
  const rowIndices: number[] = [];
  for (let r = 0; r < table.rowCount; r++) rowIndices.push(r);

  rowIndices.sort((rA, rB) => {
    const valA = table.get(rA, colIdx);
    const valB = table.get(rB, colIdx);
    return order * compareValues(valA, valB);
  });

  const sortedData: PrimitiveValue[][] = [];
  for (const r of rowIndices) {
    const rowArr: PrimitiveValue[] = [];
    for (let c = 0; c < table.colCount; c++) {
      rowArr.push(table.get(r, c));
    }
    sortedData.push(rowArr);
  }
  return new TMatrix(sortedData);
}

function scanTableElements(table: TMatrix, scanByCol: boolean): PrimitiveValue[] {
  const res: PrimitiveValue[] = [];
  if (scanByCol) {
    for (let c = 0; c < table.colCount; c++) {
      for (let r = 0; r < table.rowCount; r++) {
        res.push(table.get(r, c));
      }
    }
  } else {
    for (let r = 0; r < table.rowCount; r++) {
      for (let c = 0; c < table.colCount; c++) {
        res.push(table.get(r, c));
      }
    }
  }
  return res;
}

function filterArrayElements(items: PrimitiveValue[], ignore: number): PrimitiveValue[] {
  // ignore: 0=keep all, 1=ignore blanks, 2=ignore errors, 3=ignore blanks and errors
  return items.filter((item) => {
    const isBlank = item === null || item === undefined || item === "";
    const isErr = TrellisError.isError(item);
    if (ignore === 1 && isBlank) return false;
    if (ignore === 2 && isErr) return false;
    if (ignore === 3 && (isBlank || isErr)) return false;
    return true;
  });
}
