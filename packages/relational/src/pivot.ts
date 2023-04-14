/**
 * Multi-dimensional Pivot Table calculation engine with hierarchical headers and grand totals.
 */

import { RelationalTable } from "./table.js";
import { AggregationType } from "./groupby.js";
import { PrimitiveValue, TMatrix, coerceToNumber } from "@trellis/core";

export interface PivotValueSpec {
  readonly column: string;
  readonly aggregation: AggregationType;
  readonly label?: string;
}

export interface PivotConfig {
  readonly rowFields: string[];
  readonly columnFields: string[];
  readonly values: PivotValueSpec[];
  readonly showGrandTotals?: boolean;
}

export class PivotEngine {
  /**
   * Computes a 2D Pivot Table matrix from relational input records.
   */
  public static computePivot(table: RelationalTable, config: PivotConfig): TMatrix {
    const showGrandTotals = config.showGrandTotals !== false;

    // 1. Identify unique distinct row groups
    const rowGroupMap = new Map<string, PrimitiveValue[]>();
    // 2. Identify unique distinct column groups
    const colGroupMap = new Map<string, PrimitiveValue[]>();

    for (const row of table.rows) {
      // Row key
      const rVals = config.rowFields.map((f) => row[f] ?? "Total");
      const rKey = rVals.join("||");
      if (!rowGroupMap.has(rKey)) rowGroupMap.set(rKey, rVals);

      // Col key
      const cVals = config.columnFields.map((f) => row[f] ?? "Total");
      const cKey = cVals.join("||");
      if (!colGroupMap.has(cKey)) colGroupMap.set(cKey, cVals);
    }

    const rowGroups = Array.from(rowGroupMap.entries());
    const colGroups = Array.from(colGroupMap.entries());

    // 3. Accumulator matrix: rowKey -> colKey -> valueIndex -> accumulator
    const cellData = new Map<string, Map<string, { sum: number; count: number; min: number; max: number }[]>>();

    for (const row of table.rows) {
      const rKey = config.rowFields.map((f) => row[f] ?? "Total").join("||");
      const cKey = config.columnFields.map((f) => row[f] ?? "Total").join("||");

      let rowMap = cellData.get(rKey);
      if (!rowMap) {
        rowMap = new Map();
        cellData.set(rKey, rowMap);
      }

      let accList = rowMap.get(cKey);
      if (!accList) {
        accList = config.values.map(() => ({ sum: 0, count: 0, min: Infinity, max: -Infinity }));
        rowMap.set(cKey, accList);
      }

      for (let vIdx = 0; vIdx < config.values.length; vIdx++) {
        const spec = config.values[vIdx]!;
        const raw = row[spec.column];
        if (raw !== null && raw !== undefined && raw !== "") {
          const num = coerceToNumber(raw);
          const acc = accList[vIdx]!;
          acc.sum += num;
          acc.count++;
          if (num < acc.min) acc.min = num;
          if (num > acc.max) acc.max = num;
        }
      }
    }

    // 4. Construct 2D Output Grid
    const outputGrid: PrimitiveValue[][] = [];

    // Header row 1: Row field labels + Column group labels
    const headerRow: PrimitiveValue[] = [...config.rowFields];
    for (const [, cVals] of colGroups) {
      const colLabel = cVals.join(" - ");
      for (const valSpec of config.values) {
        const label = valSpec.label || `${valSpec.aggregation} of ${valSpec.column}`;
        headerRow.push(cVals.length > 0 ? `${colLabel} (${label})` : label);
      }
    }
    if (showGrandTotals) {
      for (const valSpec of config.values) {
        headerRow.push(`Total (${valSpec.label || valSpec.column})`);
      }
    }
    outputGrid.push(headerRow);

    // Data rows
    const colTotals = new Array(colGroups.length * config.values.length).fill(0);
    const overallGrandTotals = new Array(config.values.length).fill(0);

    for (const [rKey, rVals] of rowGroups) {
      const gridRow: PrimitiveValue[] = [...rVals];
      const rowTotals = new Array(config.values.length).fill(0);

      let colOffset = 0;
      for (const [cKey] of colGroups) {
        const accList = cellData.get(rKey)?.get(cKey);
        for (let vIdx = 0; vIdx < config.values.length; vIdx++) {
          const spec = config.values[vIdx]!;
          let cellResult: PrimitiveValue = null;

          if (accList && accList[vIdx] && accList[vIdx]!.count > 0) {
            const acc = accList[vIdx]!;
            switch (spec.aggregation) {
              case "SUM":
                cellResult = acc.sum;
                break;
              case "COUNT":
                cellResult = acc.count;
                break;
              case "AVERAGE":
                cellResult = acc.sum / acc.count;
                break;
              case "MIN":
                cellResult = acc.min;
                break;
              case "MAX":
                cellResult = acc.max;
                break;
            }
            if (typeof cellResult === "number") {
              rowTotals[vIdx] += cellResult;
              colTotals[colOffset] += cellResult;
            }
          }

          gridRow.push(cellResult);
          colOffset++;
        }
      }

      if (showGrandTotals) {
        for (let vIdx = 0; vIdx < config.values.length; vIdx++) {
          gridRow.push(rowTotals[vIdx]);
          overallGrandTotals[vIdx] += rowTotals[vIdx]!;
        }
      }

      outputGrid.push(gridRow);
    }

    // Grand total row
    if (showGrandTotals) {
      const grandTotalRow: PrimitiveValue[] = ["Grand Total"];
      for (let i = 1; i < config.rowFields.length; i++) grandTotalRow.push("");
      for (const cTot of colTotals) grandTotalRow.push(cTot);
      for (const oTot of overallGrandTotals) grandTotalRow.push(oTot);
      outputGrid.push(grandTotalRow);
    }

    return new TMatrix(outputGrid);
  }
}
