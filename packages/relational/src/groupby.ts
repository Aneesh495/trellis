/**
 * Hash aggregation and grouping pipeline across multiple dimensional keys.
 */

import { RelationalTable, TableRow } from "./table.js";
import { coerceToNumber } from "@trellis/core";

export type AggregationType = "SUM" | "COUNT" | "AVERAGE" | "MIN" | "MAX";

export interface AggregateSpec {
  readonly column: string;
  readonly as: string;
  readonly type: AggregationType;
}

interface GroupAccumulator {
  keys: TableRow;
  count: number;
  sums: Map<string, number>;
  mins: Map<string, number>;
  maxs: Map<string, number>;
}

export function groupBy(
  table: RelationalTable,
  groupKeys: string[],
  aggregates: AggregateSpec[]
): RelationalTable {
  const groups = new Map<string, GroupAccumulator>();

  for (const row of table.rows) {
    // Generate composite group hash key
    const keyParts = groupKeys.map((k) => String(row[k] ?? ""));
    const groupHash = keyParts.join("||");

    let acc = groups.get(groupHash);
    if (!acc) {
      const groupKeyValues: TableRow = {};
      for (const k of groupKeys) {
        groupKeyValues[k] = row[k] ?? null;
      }
      acc = {
        keys: groupKeyValues,
        count: 0,
        sums: new Map(),
        mins: new Map(),
        maxs: new Map()
      };
      groups.set(groupHash, acc);
    }

    acc.count++;

    const seenCols = new Set<string>();
    for (const agg of aggregates) {
      if (seenCols.has(agg.column)) continue;
      seenCols.add(agg.column);

      const rawVal = row[agg.column];
      if (rawVal !== null && rawVal !== undefined && rawVal !== "") {
        const numVal = coerceToNumber(rawVal);
        // SUM and AVERAGE
        acc.sums.set(agg.column, (acc.sums.get(agg.column) || 0) + numVal);
        // MIN
        const curMin = acc.mins.get(agg.column) ?? Infinity;
        if (numVal < curMin) acc.mins.set(agg.column, numVal);
        // MAX
        const curMax = acc.maxs.get(agg.column) ?? -Infinity;
        if (numVal > curMax) acc.maxs.set(agg.column, numVal);
      }
    }
  }

  const resultColumns = [...groupKeys, ...aggregates.map((a) => a.as)];
  const resultRows: TableRow[] = [];

  for (const acc of groups.values()) {
    const row: TableRow = { ...acc.keys };
    for (const agg of aggregates) {
      switch (agg.type) {
        case "SUM":
          row[agg.as] = acc.sums.get(agg.column) ?? 0;
          break;
        case "COUNT":
          row[agg.as] = acc.count;
          break;
        case "AVERAGE": {
          const sum = acc.sums.get(agg.column) ?? 0;
          row[agg.as] = acc.count > 0 ? sum / acc.count : 0;
          break;
        }
        case "MIN":
          row[agg.as] = acc.mins.has(agg.column) ? acc.mins.get(agg.column)! : null;
          break;
        case "MAX":
          row[agg.as] = acc.maxs.has(agg.column) ? acc.maxs.get(agg.column)! : null;
          break;
      }
    }
    resultRows.push(row);
  }

  return new RelationalTable(resultColumns, resultRows);
}
