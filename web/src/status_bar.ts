/**
 * Live status bar aggregator updating selection metrics (count, sum, average).
 */

import { formatCellRef, RangeCoord } from "@trellis/core";
import { TrellisEngine } from "@trellis/engine";
import { SelectionManager } from "@trellis/client";

export class StatusBarController {
  private readonly statCell: HTMLElement | null;
  private readonly statCount: HTMLElement | null;
  private readonly statSum: HTMLElement | null;
  private readonly statAvg: HTMLElement | null;

  constructor() {
    this.statCell = document.getElementById("stat-cell");
    this.statCount = document.getElementById("stat-count");
    this.statSum = document.getElementById("stat-sum");
    this.statAvg = document.getElementById("stat-avg");
  }

  public update(engine: TrellisEngine, sheetName: string, selection: SelectionManager): void {
    const cursor = selection.cursor;
    const range = selection.primaryRange;

    if (this.statCell) {
      this.statCell.textContent = formatCellRef(cursor);
    }

    const { count, sum, numericCount } = this.computeRangeStats(engine, sheetName, range);

    if (this.statCount) {
      this.statCount.textContent = `Count: ${count}`;
    }

    if (this.statSum) {
      this.statSum.textContent = `Sum: ${sum.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    }

    if (this.statAvg) {
      const avg = numericCount > 0 ? sum / numericCount : 0;
      this.statAvg.textContent = `Avg: ${avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    }
  }

  private computeRangeStats(
    engine: TrellisEngine,
    sheetName: string,
    range: RangeCoord
  ): { count: number; sum: number; numericCount: number } {
    const r0 = Math.min(range.startRow, range.endRow);
    const r1 = Math.max(range.startRow, range.endRow);
    const c0 = Math.min(range.startCol, range.endCol);
    const c1 = Math.max(range.startCol, range.endCol);

    let count = 0;
    let sum = 0;
    let numericCount = 0;

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        count++;
        const val = engine.getCellValue(sheetName, { row: r, col: c });
        if (typeof val === "number" && !isNaN(val)) {
          sum += val;
          numericCount++;
        }
      }
    }

    return { count, sum, numericCount };
  }
}
