/**
 * Trellis Web Studio Single-Page Application Entrypoint.
 */

import { formatCellRef } from "@trellis/core";
import { TrellisEngine } from "@trellis/engine";
import {
  ViewportManager,
  SelectionManager,
  CanvasGridRenderer,
  FormulaBarController,
  ClipboardManager,
  DependencyVisualizer
} from "@trellis/client";
import { RibbonController } from "./ribbon.js";
import { SheetTabsController } from "./sheet_tabs.js";
import { StatusBarController } from "./status_bar.js";
import { ChartRenderer } from "./chart_renderer.js";
import { loadFinancialModel } from "./models/financial_model.js";
import { loadSalesDataset } from "./models/pivot_demo.js";

export class TrellisStudioApp {
  public readonly engine: TrellisEngine;
  public readonly viewport: ViewportManager;
  public readonly selection: SelectionManager;
  public readonly renderer: CanvasGridRenderer;
  public readonly formulaBar: FormulaBarController;
  public readonly clipboard: ClipboardManager;
  public readonly visualizer: DependencyVisualizer;
  public readonly ribbon: RibbonController;
  public readonly sheetTabs: SheetTabsController;
  public readonly statusBar: StatusBarController;
  public readonly chartRenderer: ChartRenderer;

  public activeSheetName = "Model";
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private dpr = 1;
  private isMouseDown = false;
  private showDependencyArrows = false;

  constructor() {
    this.engine = new TrellisEngine();
    this.viewport = new ViewportManager();
    this.selection = new SelectionManager();
    this.renderer = new CanvasGridRenderer();
    this.formulaBar = new FormulaBarController();
    this.clipboard = new ClipboardManager();
    this.visualizer = new DependencyVisualizer();
    this.ribbon = new RibbonController();
    this.sheetTabs = new SheetTabsController((sheet) => this.switchSheet(sheet));
    this.statusBar = new StatusBarController();
    this.chartRenderer = new ChartRenderer();
  }

  public init(): void {
    this.canvas = document.getElementById("grid-canvas") as HTMLCanvasElement;
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext("2d");
    this.dpr = window.devicePixelRatio || 1;

    // Load initial financial model
    loadFinancialModel(this.engine);
    loadSalesDataset(this.engine);

    // Initialize UI controllers
    this.ribbon.init(
      this.engine,
      this.selection,
      () => this.activeSheetName,
      () => this.render()
    );

    this.ribbon.onTracePrecedents = () => {
      this.showDependencyArrows = true;
      this.render();
    };

    this.ribbon.onClearTrace = () => {
      this.showDependencyArrows = false;
      this.render();
    };

    this.ribbon.onToggleChart = () => {
      const drawer = document.getElementById("side-drawer");
      if (drawer) {
        drawer.classList.toggle("drawer-closed");
        if (!drawer.classList.contains("drawer-closed")) {
          this.updateChartPreview();
        }
      }
    };

    this.sheetTabs.init(this.engine, this.activeSheetName);

    this.setupResizeListener();
    this.setupMouseEvents();
    this.setupKeyboardEvents();
    this.setupFormulaBar();
    this.setupExportButtons();

    this.resizeCanvas();
    this.render();
  }

  public switchSheet(sheetName: string): void {
    this.activeSheetName = sheetName;
    this.selection.selectCell(0, 0);
    this.syncFormulaBar();
    this.render();
  }

  public render(): void {
    if (!this.canvas || !this.ctx) return;

    this.ctx.save();
    this.ctx.scale(this.dpr, this.dpr);

    this.renderer.render(
      this.ctx as any,
      this.engine,
      this.activeSheetName,
      this.viewport,
      this.selection
    );

    if (this.showDependencyArrows) {
      const arrows = this.visualizer.generateArrows(
        this.engine.dag,
        { ...this.selection.cursor, sheet: this.activeSheetName },
        this.viewport,
        "both"
      );
      this.visualizer.render(this.ctx as any, arrows);
    }

    this.ctx.restore();
    this.statusBar.update(this.engine, this.activeSheetName, this.selection);
  }

  private setupResizeListener(): void {
    window.addEventListener("resize", () => {
      this.resizeCanvas();
      this.render();
    });
  }

  private resizeCanvas(): void {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const width = parent.clientWidth;
    const height = parent.clientHeight;

    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.viewport.viewportWidth = width;
    this.viewport.viewportHeight = height;
  }

  private setupMouseEvents(): void {
    if (!this.canvas) return;

    this.canvas.addEventListener("mousedown", (e) => {
      this.isMouseDown = true;
      const rect = this.canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const hit = this.viewport.hitTest(x, y);
      if (!hit.isHeaderCol && !hit.isHeaderRow) {
        this.selection.selectCell(hit.row, hit.col, e.shiftKey);
        this.syncFormulaBar();
        this.render();
      }
    });

    this.canvas.addEventListener("mousemove", (e) => {
      if (!this.isMouseDown) return;
      const rect = this.canvas!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const hit = this.viewport.hitTest(x, y);
      if (!hit.isHeaderCol && !hit.isHeaderRow) {
        this.selection.selectCell(hit.row, hit.col, true);
        this.syncFormulaBar();
        this.render();
      }
    });

    window.addEventListener("mouseup", () => {
      this.isMouseDown = false;
    });

    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.viewport.scrollX = Math.max(0, this.viewport.scrollX + e.deltaX);
      this.viewport.scrollY = Math.max(0, this.viewport.scrollY + e.deltaY);
      this.render();
    }, { passive: false });
  }

  private setupKeyboardEvents(): void {
    window.addEventListener("keydown", (e) => {
      const activeEl = document.activeElement;
      if (activeEl && activeEl.tagName === "INPUT") return;

      const cursor = this.selection.cursor;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          this.selection.selectCell(cursor.row - 1, cursor.col, e.shiftKey);
          this.syncFormulaBar();
          this.render();
          break;
        case "ArrowDown":
          e.preventDefault();
          this.selection.selectCell(cursor.row + 1, cursor.col, e.shiftKey);
          this.syncFormulaBar();
          this.render();
          break;
        case "ArrowLeft":
          e.preventDefault();
          this.selection.selectCell(cursor.row, cursor.col - 1, e.shiftKey);
          this.syncFormulaBar();
          this.render();
          break;
        case "ArrowRight":
          e.preventDefault();
          this.selection.selectCell(cursor.row, cursor.col + 1, e.shiftKey);
          this.syncFormulaBar();
          this.render();
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          this.engine.clearCell(this.activeSheetName, cursor);
          this.syncFormulaBar();
          this.render();
          break;
      }
    });
  }

  private setupFormulaBar(): void {
    const formulaInput = document.getElementById("formula-input") as HTMLInputElement;
    if (!formulaInput) return;

    formulaInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const cursor = this.selection.cursor;
        this.engine.setCell(this.activeSheetName, cursor, formulaInput.value);
        formulaInput.blur();
        this.render();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.syncFormulaBar();
        formulaInput.blur();
      }
    });
  }

  private syncFormulaBar(): void {
    const cursor = this.selection.cursor;
    const nameBox = document.getElementById("name-box");
    const formulaInput = document.getElementById("formula-input") as HTMLInputElement;

    if (nameBox) {
      nameBox.textContent = formatCellRef(cursor);
    }

    if (formulaInput) {
      const formula = this.engine.getCellFormula(this.activeSheetName, cursor);
      const raw = this.engine.getCellRaw(this.activeSheetName, cursor);
      formulaInput.value = formula || raw || "";
    }
  }

  private setupExportButtons(): void {
    document.getElementById("btn-export-csv")?.addEventListener("click", () => {
      const csv = this.engine.workbook.getSheet(this.activeSheetName)?.getAllCells();
      if (!csv) return;
      alert(`Exported CSV for sheet: ${this.activeSheetName}`);
    });

    document.getElementById("btn-load-demo")?.addEventListener("click", () => {
      loadFinancialModel(this.engine);
      this.switchSheet("Model");
    });

    document.getElementById("btn-close-drawer")?.addEventListener("click", () => {
      document.getElementById("side-drawer")?.classList.add("drawer-closed");
    });
  }

  private updateChartPreview(): void {
    const chartCanvas = document.getElementById("chart-canvas") as HTMLCanvasElement;
    if (!chartCanvas) return;

    this.chartRenderer.render(chartCanvas, {
      title: "Revenue Forecast ($M)",
      labels: ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"],
      type: "bar",
      series: [
        {
          name: "Revenue",
          color: "#2563EB",
          data: [100.0, 115.0, 132.25, 152.09, 174.9]
        }
      ]
    });
  }
}

// Auto-instantiate when running in browser
if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    const app = new TrellisStudioApp();
    app.init();
    (window as any).trellisApp = app;
  });
}
