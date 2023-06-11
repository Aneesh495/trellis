/**
 * Ribbon controller managing tab activations, cell formatting actions, and formula injections.
 */

import { formatCellRef, formatRangeRef } from "@trellis/core";
import { TrellisEngine } from "@trellis/engine";
import { SelectionManager } from "@trellis/client";

export class RibbonController {
  public onTracePrecedents?: () => void;
  public onTraceDependents?: () => void;
  public onClearTrace?: () => void;
  public onToggleChart?: () => void;

  public init(
    engine: TrellisEngine,
    selection: SelectionManager,
    getSheet: () => string,
    refreshGrid: () => void
  ): void {
    // 1. Tab switching
    const tabButtons = document.querySelectorAll<HTMLButtonElement>(".ribbon-tab");
    const panels = document.querySelectorAll<HTMLElement>(".ribbon-panel");

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabButtons.forEach((b) => b.classList.remove("active"));
        panels.forEach((p) => p.classList.remove("active"));

        btn.classList.add("active");
        const targetId = `panel-${btn.dataset.tab}`;
        document.getElementById(targetId)?.classList.add("active");
      });
    });

    // 2. Cell Formatting
    const applyFormat = (modifier: (fmt: any) => void) => {
      const sheetName = getSheet();
      const sheet = engine.workbook.getSheet(sheetName);
      if (!sheet) return;

      const r = selection.primaryRange;
      for (let row = r.startRow; row <= r.endRow; row++) {
        for (let col = r.startCol; col <= r.endCol; col++) {
          const cell = sheet.getOrCreateCell(row, col);
          const currentFmt = cell.format ? { ...cell.format } : {};
          modifier(currentFmt);
          cell.format = currentFmt;
        }
      }
      refreshGrid();
    };

    document.getElementById("btn-bold")?.addEventListener("click", () => {
      applyFormat((fmt) => { fmt.bold = !fmt.bold; });
    });

    document.getElementById("btn-italic")?.addEventListener("click", () => {
      applyFormat((fmt) => { fmt.italic = !fmt.italic; });
    });

    document.getElementById("btn-underline")?.addEventListener("click", () => {
      applyFormat((fmt) => { fmt.underline = !fmt.underline; });
    });

    document.getElementById("btn-align-left")?.addEventListener("click", () => {
      applyFormat((fmt) => { fmt.align = "left"; });
    });

    document.getElementById("btn-align-center")?.addEventListener("click", () => {
      applyFormat((fmt) => { fmt.align = "center"; });
    });

    document.getElementById("btn-align-right")?.addEventListener("click", () => {
      applyFormat((fmt) => { fmt.align = "right"; });
    });

    document.getElementById("btn-fmt-currency")?.addEventListener("click", () => {
      applyFormat((fmt) => { fmt.numberFormat = "$#,##0.00"; });
    });

    document.getElementById("btn-fmt-percent")?.addEventListener("click", () => {
      applyFormat((fmt) => { fmt.numberFormat = "0.0%"; });
    });

    // 3. Formula Insertions
    document.getElementById("btn-insert-sum")?.addEventListener("click", () => {
      const range = selection.primaryRange;
      const targetRef = formatCellRef({ row: range.endRow + 1, col: range.startCol });
      const sumRangeStr = formatRangeRef(range);
      engine.setCell(getSheet(), targetRef, `=SUM(${sumRangeStr})`);
      refreshGrid();
    });

    // 4. Trace Dependencies
    document.getElementById("btn-trace-precedents")?.addEventListener("click", () => {
      this.onTracePrecedents?.();
    });

    document.getElementById("btn-trace-dependents")?.addEventListener("click", () => {
      this.onTraceDependents?.();
    });

    document.getElementById("btn-clear-trace")?.addEventListener("click", () => {
      this.onClearTrace?.();
    });

    // 5. Chart panel toggle
    document.getElementById("btn-toggle-chart")?.addEventListener("click", () => {
      this.onToggleChart?.();
    });
  }
}
