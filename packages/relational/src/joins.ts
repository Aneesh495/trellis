/**
 * Equi-join relational algorithms with hash indexing on build relation.
 */

import { RelationalTable, TableRow } from "./table.js";

export type JoinType = "inner" | "left" | "right" | "full";

export function hashJoin(
  left: RelationalTable,
  right: RelationalTable,
  leftKey: string,
  rightKey: string,
  type: JoinType = "inner"
): RelationalTable {
  // Disambiguate overlapping column names (except join key if identical)
  const leftCols = left.columns;
  const rightCols = right.columns.map((c) =>
    leftCols.includes(c) && c !== rightKey ? `${c}_right` : c
  );
  const combinedColumns = Array.from(new Set([...leftCols, ...rightCols]));

  // Build phase: construct hash map on right table
  const rightMap = new Map<string, TableRow[]>();
  for (const rRow of right.rows) {
    const kVal = String(rRow[rightKey] ?? "");
    let bucket = rightMap.get(kVal);
    if (!bucket) {
      bucket = [];
      rightMap.set(kVal, bucket);
    }
    bucket.push(rRow);
  }

  const resultRows: TableRow[] = [];
  const matchedRightIndices = new Set<TableRow>();

  // Probe phase on left table
  for (const lRow of left.rows) {
    const kVal = String(lRow[leftKey] ?? "");
    const matchingRightRows = rightMap.get(kVal);

    if (matchingRightRows && matchingRightRows.length > 0) {
      for (const rRow of matchingRightRows) {
        matchedRightIndices.add(rRow);
        const mergedRow: TableRow = { ...lRow };
        for (let i = 0; i < right.columns.length; i++) {
          const origName = right.columns[i]!;
          const targetName = rightCols[i]!;
          mergedRow[targetName] = rRow[origName] ?? null;
        }
        resultRows.push(mergedRow);
      }
    } else if (type === "left" || type === "full") {
      const mergedRow: TableRow = { ...lRow };
      for (const rCol of rightCols) {
        if (!(rCol in mergedRow)) {
          mergedRow[rCol] = null;
        }
      }
      resultRows.push(mergedRow);
    }
  }

  // Right outer or full outer pass for unmatched right rows
  if (type === "right" || type === "full") {
    for (const rRow of right.rows) {
      if (!matchedRightIndices.has(rRow)) {
        const mergedRow: TableRow = {};
        for (const lCol of leftCols) {
          mergedRow[lCol] = null;
        }
        for (let i = 0; i < right.columns.length; i++) {
          const origName = right.columns[i]!;
          const targetName = rightCols[i]!;
          mergedRow[targetName] = rRow[origName] ?? null;
        }
        resultRows.push(mergedRow);
      }
    }
  }

  return new RelationalTable(combinedColumns, resultRows);
}
