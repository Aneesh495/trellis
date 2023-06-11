/**
 * Sheet tabs controller for dynamic multi-sheet switching and creation.
 */

import { TrellisEngine } from "@trellis/engine";

export class SheetTabsController {
  private readonly container: HTMLElement | null;
  private readonly addBtn: HTMLElement | null;
  private onSheetChangeCallback?: (sheetName: string) => void;

  constructor(onSheetChange?: (sheetName: string) => void) {
    this.container = document.getElementById("sheet-tabs");
    this.addBtn = document.getElementById("btn-add-sheet");
    this.onSheetChangeCallback = onSheetChange;
  }

  public init(engine: TrellisEngine, currentActiveSheet: string): void {
    if (this.addBtn) {
      this.addBtn.addEventListener("click", () => {
        const nextIdx = engine.workbook.sheets.length + 1;
        const newName = `Sheet${nextIdx}`;
        engine.workbook.addSheet(newName);
        this.renderTabs(engine, newName);
        if (this.onSheetChangeCallback) {
          this.onSheetChangeCallback(newName);
        }
      });
    }

    this.renderTabs(engine, currentActiveSheet);
  }

  public renderTabs(engine: TrellisEngine, activeSheetName: string): void {
    if (!this.container) return;

    this.container.innerHTML = "";

    for (const sheet of engine.workbook.sheets) {
      const btn = document.createElement("button");
      btn.className = `sheet-tab ${sheet.name === activeSheetName ? "active" : ""}`;
      btn.textContent = sheet.name;
      btn.dataset.sheet = sheet.name;

      btn.addEventListener("click", () => {
        this.renderTabs(engine, sheet.name);
        if (this.onSheetChangeCallback) {
          this.onSheetChangeCallback(sheet.name);
        }
      });

      this.container.appendChild(btn);
    }
  }
}
