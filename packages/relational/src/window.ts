/**
 * Analytical window functions: ranking, running totals, and moving averages.
 */

import { RelationalTable } from "./table.js";
import { coerceToNumber, compareValues } from "@trellis/core";

export class WindowFunctions {
  /**
   * Generates sequential row numbers partitioned or ordered by column.
   */
  public static rowNumber(table: RelationalTable): number[] {
    return table.rows.map((_, i) => i + 1);
  }

  /**
   * Generates standard competition ranks (1, 2, 2, 4) ordered by specified column.
   */
  public static rank(table: RelationalTable, orderByCol: string, order: 1 | -1 = 1): number[] {
    const indices: number[] = table.rows.map((_, i) => i);
    indices.sort((iA, iB) => {
      const valA = table.rows[iA]![orderByCol];
      const valB = table.rows[iB]![orderByCol];
      return order * compareValues(valA, valB);
    });

    const result = new Array(table.rows.length);
    let currentRank = 1;

    for (let i = 0; i < indices.length; i++) {
      if (i > 0) {
        const prevIdx = indices[i - 1]!;
        const currIdx = indices[i]!;
        const prevVal = table.rows[prevIdx]![orderByCol];
        const currVal = table.rows[currIdx]![orderByCol];
        if (compareValues(prevVal, currVal) !== 0) {
          currentRank = i + 1;
        }
      }
      result[indices[i]!] = currentRank;
    }

    return result;
  }

  /**
   * Calculates running cumulative sum over rows.
   */
  public static runningSum(table: RelationalTable, valueCol: string, partitionByCol?: string): number[] {
    const result: number[] = [];
    const partitionTotals = new Map<string, number>();

    for (const row of table.rows) {
      const pKey = partitionByCol ? String(row[partitionByCol] ?? "") : "__GLOBAL__";
      const val = coerceToNumber(row[valueCol]);
      const current = (partitionTotals.get(pKey) || 0) + val;
      partitionTotals.set(pKey, current);
      result.push(current);
    }

    return result;
  }

  /**
   * Calculates moving average over a sliding window.
   */
  public static movingAverage(table: RelationalTable, valueCol: string, windowSize: number): number[] {
    if (windowSize <= 0) return new Array(table.rows.length).fill(0);
    const result: number[] = [];
    const buffer: number[] = [];
    let runningTotal = 0;

    for (const row of table.rows) {
      const val = coerceToNumber(row[valueCol]);
      buffer.push(val);
      runningTotal += val;

      if (buffer.length > windowSize) {
        runningTotal -= buffer.shift()!;
      }

      result.push(runningTotal / buffer.length);
    }

    return result;
  }
}
