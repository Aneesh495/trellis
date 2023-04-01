/**
 * Relational lookup, exact and binary search, matrix indexers, and dimensional slicing.
 */

import { FunctionRegistry } from "./registry.js";
import { CellValue, PrimitiveValue, TMatrix, TrellisError, coerceToNumber, compareValues } from "@trellis/core";

export function registerLookupFunctions(reg: FunctionRegistry): void {
  // VLOOKUP
  reg.register({
    name: "VLOOKUP",
    category: "lookup",
    minArgs: 3,
    maxArgs: 4,
    description: "Looks up value in the first column of a table and returns value in same row from another column",
    fn: (args) => {
      const lookupVal = args[0]!;
      const table = toMatrix(args[1]!);
      const colIdx = Math.trunc(coerceToNumber(args[2]!));
      const rangeLookup = args.length > 3 ? Boolean(args[3]) : true;

      if (colIdx < 1 || colIdx > table.colCount) {
        throw TrellisError.refError(`VLOOKUP column index ${colIdx} out of table column bounds`);
      }

      const rows = table.rowCount;
      if (rangeLookup) {
        // Approximate sorted match (largest value less than or equal to lookup value)
        let bestRow = -1;
        for (let r = 0; r < rows; r++) {
          const cellVal = table.get(r, 0);
          const cmp = compareValues(cellVal, lookupVal);
          if (cmp === 0) {
            return table.get(r, colIdx - 1);
          } else if (cmp < 0) {
            bestRow = r;
          } else {
            break;
          }
        }
        if (bestRow !== -1) {
          return table.get(bestRow, colIdx - 1);
        }
        throw TrellisError.naError("VLOOKUP approximate match failed");
      } else {
        // Exact match
        for (let r = 0; r < rows; r++) {
          const cellVal = table.get(r, 0);
          if (compareValues(cellVal, lookupVal) === 0) {
            return table.get(r, colIdx - 1);
          }
        }
        throw TrellisError.naError("VLOOKUP exact match failed");
      }
    }
  });

  // HLOOKUP
  reg.register({
    name: "HLOOKUP",
    category: "lookup",
    minArgs: 3,
    maxArgs: 4,
    description: "Looks up value in top row of a table and returns value in same column from another row",
    fn: (args) => {
      const lookupVal = args[0]!;
      const table = toMatrix(args[1]!);
      const rowIdx = Math.trunc(coerceToNumber(args[2]!));
      const rangeLookup = args.length > 3 ? Boolean(args[3]) : true;

      if (rowIdx < 1 || rowIdx > table.rowCount) {
        throw TrellisError.refError(`HLOOKUP row index ${rowIdx} out of table row bounds`);
      }

      const cols = table.colCount;
      for (let c = 0; c < cols; c++) {
        const cellVal = table.get(0, c);
        if (compareValues(cellVal, lookupVal) === 0) {
          return table.get(rowIdx - 1, c);
        }
      }
      if (rangeLookup) {
        let bestCol = -1;
        for (let c = 0; c < cols; c++) {
          const cellVal = table.get(0, c);
          if (compareValues(cellVal, lookupVal) <= 0) {
            bestCol = c;
          } else {
            break;
          }
        }
        if (bestCol !== -1) {
          return table.get(rowIdx - 1, bestCol);
        }
      }
      throw TrellisError.naError("HLOOKUP match failed");
    }
  });

  // XLOOKUP
  reg.register({
    name: "XLOOKUP",
    category: "lookup",
    minArgs: 3,
    maxArgs: 6,
    description: "Searches range for a match and returns corresponding item from a second range",
    fn: (args) => {
      const lookupVal = args[0]!;
      const lookupArr = toMatrix(args[1]!).flatten();
      const returnMat = toMatrix(args[2]!);
      const ifNotFound = args.length > 3 ? args[3] : TrellisError.naError();
      const matchMode = args.length > 4 ? Math.trunc(coerceToNumber(args[4]!)) : 0;
      const searchMode = args.length > 5 ? Math.trunc(coerceToNumber(args[5]!)) : 1;

      const len = lookupArr.length;
      let matchedIdx = -1;

      if (searchMode === 2 || searchMode === -2) {
        // Binary search
        let low = 0;
        let high = len - 1;
        const ascending = searchMode === 2;

        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          const cmp = compareValues(lookupArr[mid]!, lookupVal);
          if (cmp === 0) {
            matchedIdx = mid;
            break;
          }
          if (ascending) {
            if (cmp < 0) low = mid + 1;
            else high = mid - 1;
          } else {
            if (cmp > 0) low = mid + 1;
            else high = mid - 1;
          }
        }
      } else {
        // Linear search (first-to-last or last-to-first)
        const step = searchMode === -1 ? -1 : 1;
        const start = searchMode === -1 ? len - 1 : 0;
        const end = searchMode === -1 ? -1 : len;

        for (let i = start; i !== end; i += step) {
          const val = lookupArr[i]!;
          if (matchMode === 0) {
            // Exact match
            if (compareValues(val, lookupVal) === 0) {
              matchedIdx = i;
              break;
            }
          } else if (matchMode === -1) {
            // Exact or next smaller
            if (compareValues(val, lookupVal) <= 0) {
              matchedIdx = i;
              break;
            }
          } else if (matchMode === 1) {
            // Exact or next larger
            if (compareValues(val, lookupVal) >= 0) {
              matchedIdx = i;
              break;
            }
          }
        }
      }

      if (matchedIdx === -1) {
        if (ifNotFound instanceof TrellisError) throw ifNotFound;
        return ifNotFound ?? null;
      }

      // Return slice from returnMat at matchedIdx
      if (returnMat.rowCount === 1) {
        return returnMat.get(0, matchedIdx);
      }
      if (returnMat.colCount === 1) {
        return returnMat.get(matchedIdx, 0);
      }
      return returnMat.slice(matchedIdx, 0, matchedIdx, returnMat.colCount - 1);
    }
  });

  // INDEX
  reg.register({
    name: "INDEX",
    category: "lookup",
    minArgs: 2,
    maxArgs: 3,
    description: "Returns a value from within a table or range indexed by row and column",
    fn: (args) => {
      const table = toMatrix(args[0]!);
      const rowNum = Math.trunc(coerceToNumber(args[1]!));
      const colNum = args.length > 2 ? Math.trunc(coerceToNumber(args[2]!)) : 1;

      if (rowNum < 0 || rowNum > table.rowCount || colNum < 0 || colNum > table.colCount) {
        throw TrellisError.refError();
      }

      if (rowNum === 0 && colNum === 0) return table;
      if (rowNum === 0) return table.slice(0, colNum - 1, table.rowCount - 1, colNum - 1);
      if (colNum === 0) return table.slice(rowNum - 1, 0, rowNum - 1, table.colCount - 1);

      return table.get(rowNum - 1, colNum - 1);
    }
  });

  // MATCH
  reg.register({
    name: "MATCH",
    category: "lookup",
    minArgs: 2,
    maxArgs: 3,
    description: "Returns the relative position of an item in an array matching a specified value",
    fn: (args) => {
      const lookupVal = args[0]!;
      const lookupArr = toMatrix(args[1]!).flatten();
      const matchType = args.length > 2 ? Math.trunc(coerceToNumber(args[2]!)) : 1;

      if (matchType === 0) {
        // Exact match
        for (let i = 0; i < lookupArr.length; i++) {
          if (compareValues(lookupArr[i]!, lookupVal) === 0) {
            return i + 1; // 1-based index
          }
        }
        throw TrellisError.naError("MATCH exact match failed");
      } else if (matchType === 1) {
        // Largest value less than or equal to lookup value (requires sorted ascending)
        let best = -1;
        for (let i = 0; i < lookupArr.length; i++) {
          if (compareValues(lookupArr[i]!, lookupVal) <= 0) {
            best = i;
          } else {
            break;
          }
        }
        if (best !== -1) return best + 1;
        throw TrellisError.naError("MATCH lookup failed");
      } else {
        // Smallest value greater than or equal to lookup value (requires sorted descending)
        let best = -1;
        for (let i = 0; i < lookupArr.length; i++) {
          if (compareValues(lookupArr[i]!, lookupVal) >= 0) {
            best = i;
          } else {
            break;
          }
        }
        if (best !== -1) return best + 1;
        throw TrellisError.naError("MATCH lookup failed");
      }
    }
  });

  // ROWS, COLUMNS
  reg.register({
    name: "ROWS",
    category: "lookup",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns the number of rows in a reference or array",
    fn: (args) => toMatrix(args[0]!).rowCount
  });

  reg.register({
    name: "COLUMNS",
    category: "lookup",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns the number of columns in a reference or array",
    fn: (args) => toMatrix(args[0]!).colCount
  });

  // CHOOSECOLS, CHOOSEROWS
  reg.register({
    name: "CHOOSECOLS",
    category: "lookup",
    minArgs: 2,
    maxArgs: -1,
    description: "Returns the specified columns from an array",
    fn: (args) => {
      const table = toMatrix(args[0]!);
      const cols = args.slice(1).map((a) => {
        let idx = Math.trunc(coerceToNumber(a));
        if (idx < 0) idx = table.colCount + idx + 1; // Negative indexing from end
        if (idx < 1 || idx > table.colCount) throw TrellisError.valueError("CHOOSECOLS index out of range");
        return idx - 1;
      });

      const res: PrimitiveValue[][] = [];
      for (let r = 0; r < table.rowCount; r++) {
        const rowArr: PrimitiveValue[] = [];
        for (const c of cols) {
          rowArr.push(table.get(r, c));
        }
        res.push(rowArr);
      }
      return new TMatrix(res);
    }
  });

  reg.register({
    name: "CHOOSEROWS",
    category: "lookup",
    minArgs: 2,
    maxArgs: -1,
    description: "Returns the specified rows from an array",
    fn: (args) => {
      const table = toMatrix(args[0]!);
      const rows = args.slice(1).map((a) => {
        let idx = Math.trunc(coerceToNumber(a));
        if (idx < 0) idx = table.rowCount + idx + 1;
        if (idx < 1 || idx > table.rowCount) throw TrellisError.valueError("CHOOSEROWS index out of range");
        return idx - 1;
      });

      const res: PrimitiveValue[][] = [];
      for (const r of rows) {
        const rowArr: PrimitiveValue[] = [];
        for (let c = 0; c < table.colCount; c++) {
          rowArr.push(table.get(r, c));
        }
        res.push(rowArr);
      }
      return new TMatrix(res);
    }
  });

  // TAKE, DROP
  reg.register({
    name: "TAKE",
    category: "lookup",
    minArgs: 2,
    maxArgs: 3,
    description: "Returns specified number of contiguous rows or columns from array start or end",
    fn: (args) => {
      const table = toMatrix(args[0]!);
      const numRows = Math.trunc(coerceToNumber(args[1]!));
      const numCols = args.length > 2 ? Math.trunc(coerceToNumber(args[2]!)) : table.colCount;

      let rStart = 0;
      let rEnd = Math.min(table.rowCount - 1, numRows - 1);
      if (numRows < 0) {
        rStart = Math.max(0, table.rowCount + numRows);
        rEnd = table.rowCount - 1;
      }

      let cStart = 0;
      let cEnd = Math.min(table.colCount - 1, numCols - 1);
      if (numCols < 0) {
        cStart = Math.max(0, table.colCount + numCols);
        cEnd = table.colCount - 1;
      }

      return table.slice(rStart, cStart, rEnd, cEnd);
    }
  });

  reg.register({
    name: "DROP",
    category: "lookup",
    minArgs: 2,
    maxArgs: 3,
    description: "Excludes specified number of contiguous rows or columns from array start or end",
    fn: (args) => {
      const table = toMatrix(args[0]!);
      const dropRows = Math.trunc(coerceToNumber(args[1]!));
      const dropCols = args.length > 2 ? Math.trunc(coerceToNumber(args[2]!)) : 0;

      let rStart = dropRows >= 0 ? dropRows : 0;
      let rEnd = dropRows < 0 ? table.rowCount + dropRows - 1 : table.rowCount - 1;

      let cStart = dropCols >= 0 ? dropCols : 0;
      let cEnd = dropCols < 0 ? table.colCount + dropCols - 1 : table.colCount - 1;

      if (rStart > rEnd || cStart > cEnd) throw TrellisError.calcError("Dropped all elements of array");
      return table.slice(rStart, cStart, rEnd, cEnd);
    }
  });
}

function toMatrix(val: CellValue): TMatrix {
  if (val instanceof TMatrix) return val;
  return TMatrix.scalar(val as PrimitiveValue);
}
