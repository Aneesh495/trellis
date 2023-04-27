/**
 * Virtualized 60fps Canvas2D grid rendering pipeline with theme support and multi-peer overlays.
 */

import { coerceToString, indexToCol } from "@trellis/core";
import { TrellisEngine } from "@trellis/engine";
import { PeerPresence } from "@trellis/crdt";
import { ViewportManager } from "./viewport.js";
import { SelectionManager } from "./selection.js";

export interface CanvasContext2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  stroke(): void;
  fill(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  measureText(text: string): { width: number };
  clip(): void;
  rect(x: number, y: number, w: number, h: number): void;
}

export interface GridTheme {
  background: string;
  gridLine: string;
  headerBackground: string;
  headerText: string;
  headerBorder: string;
  cellText: string;
  selectionBorder: string;
  selectionFill: string;
  fillHandle: string;
  spillBorder: string;
  spillFill: string;
}

export const DEFAULT_THEME: GridTheme = {
  background: "#FFFFFF",
  gridLine: "#E5E7EB",
  headerBackground: "#F9FAFB",
  headerText: "#4B5563",
  headerBorder: "#D1D5DB",
  cellText: "#111827",
  selectionBorder: "#2563EB",
  selectionFill: "rgba(37, 99, 235, 0.08)",
  fillHandle: "#2563EB",
  spillBorder: "#10B981",
  spillFill: "rgba(16, 185, 129, 0.08)"
};

export class CanvasGridRenderer {
  public theme: GridTheme = { ...DEFAULT_THEME };

  /**
   * Primary rendering loop executed each frame.
   */
  public render(
    ctx: CanvasContext2D,
    engine: TrellisEngine,
    sheetName: string,
    viewport: ViewportManager,
    selection: SelectionManager,
    peers: readonly PeerPresence[] = []
  ): void {
    const sheet = engine.workbook.getSheet(sheetName);
    if (!sheet) return;

    const visible = viewport.computeVisibleRange();

    // 1. Clear background
    ctx.fillStyle = this.theme.background;
    ctx.fillRect(0, 0, viewport.viewportWidth, viewport.viewportHeight);

    // 2. Render cell values and background grid lines
    this.renderCells(ctx, engine, sheetName, viewport, visible);

    // 3. Render selection rectangles and fill handle
    this.renderSelections(ctx, viewport, selection);

    // 4. Render remote peer cursors and selections
    this.renderPeers(ctx, viewport, peers, sheetName);

    // 5. Render frozen headers (column letters and row numbers)
    this.renderHeaders(ctx, viewport, visible);
  }

  private renderCells(
    ctx: CanvasContext2D,
    engine: TrellisEngine,
    sheetName: string,
    viewport: ViewportManager,
    visible: ReturnType<ViewportManager["computeVisibleRange"]>
  ): void {
    ctx.save();
    ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textBaseline = "middle";

    for (let r = visible.startRow; r <= visible.endRow; r++) {
      for (let c = visible.startCol; c <= visible.endCol; c++) {
        const rect = viewport.getCellRect(r, c);

        // Draw grid border lines
        ctx.strokeStyle = this.theme.gridLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x - 0.5, rect.y - 0.5, rect.width, rect.height);

        // Fetch evaluated cell value
        const val = engine.getCellValue(sheetName, { row: r, col: c });
        if (val !== null && val !== undefined) {
          const text = coerceToString(val);

          ctx.fillStyle = this.theme.cellText;
          if (typeof val === "number") {
            ctx.textAlign = "right";
            ctx.fillText(text, rect.x + rect.width - 6, rect.y + rect.height / 2, rect.width - 12);
          } else if (typeof val === "boolean" || typeof val === "object") {
            ctx.textAlign = "center";
            ctx.fillText(text, rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width - 8);
          } else {
            ctx.textAlign = "left";
            ctx.fillText(text, rect.x + 6, rect.y + rect.height / 2, rect.width - 12);
          }
        }
      }
    }
    ctx.restore();
  }

  private renderSelections(
    ctx: CanvasContext2D,
    viewport: ViewportManager,
    selection: SelectionManager
  ): void {
    ctx.save();
    for (const range of selection.allRanges) {
      const rect = viewport.getRangeRect(range);

      // Semi-transparent fill tint
      ctx.fillStyle = this.theme.selectionFill;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

      // Solid 2px outline
      ctx.strokeStyle = this.theme.selectionBorder;
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

      // Draw bottom-right fill handle square (6x6 px)
      ctx.fillStyle = this.theme.fillHandle;
      const handleSize = 6;
      ctx.fillRect(
        rect.x + rect.width - handleSize / 2,
        rect.y + rect.height - handleSize / 2,
        handleSize,
        handleSize
      );
    }
    ctx.restore();
  }

  private renderPeers(
    ctx: CanvasContext2D,
    viewport: ViewportManager,
    peers: readonly PeerPresence[],
    activeSheetId: string
  ): void {
    ctx.save();
    for (const peer of peers) {
      if (peer.sheetId !== activeSheetId) continue;

      if (peer.selection) {
        const rect = viewport.getRangeRect(peer.selection);
        ctx.fillStyle = `${peer.color}22`; // 13% opacity tint
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.strokeStyle = peer.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      }

      if (peer.cursor) {
        const cRect = viewport.getCellRect(peer.cursor.row, peer.cursor.col);
        ctx.fillStyle = peer.color;

        // Peer name pill tag
        ctx.font = "bold 10px sans-serif";
        const tagText = peer.name;
        const textMetrics = ctx.measureText(tagText);
        const tagWidth = textMetrics.width + 8;
        const tagHeight = 16;
        const tagX = cRect.x;
        const tagY = Math.max(0, cRect.y - tagHeight);

        ctx.fillRect(tagX, tagY, tagWidth, tagHeight);
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(tagText, tagX + tagWidth / 2, tagY + tagHeight / 2);
      }
    }
    ctx.restore();
  }

  private renderHeaders(
    ctx: CanvasContext2D,
    viewport: ViewportManager,
    visible: ReturnType<ViewportManager["computeVisibleRange"]>
  ): void {
    ctx.save();
    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textBaseline = "middle";

    // Top-left corner box
    ctx.fillStyle = this.theme.headerBackground;
    ctx.fillRect(0, 0, viewport.headerColWidth, viewport.headerRowHeight);
    ctx.strokeStyle = this.theme.headerBorder;
    ctx.strokeRect(0, 0, viewport.headerColWidth, viewport.headerRowHeight);

    // Column headers (A, B, C...)
    for (let c = visible.startCol; c <= visible.endCol; c++) {
      const rect = viewport.getCellRect(0, c);
      const headerX = rect.x;
      const headerY = 0;
      const headerW = rect.width;
      const headerH = viewport.headerRowHeight;

      ctx.fillStyle = this.theme.headerBackground;
      ctx.fillRect(headerX, headerY, headerW, headerH);
      ctx.strokeStyle = this.theme.headerBorder;
      ctx.strokeRect(headerX, headerY, headerW, headerH);

      ctx.fillStyle = this.theme.headerText;
      ctx.textAlign = "center";
      ctx.fillText(indexToCol(c), headerX + headerW / 2, headerH / 2);
    }

    // Row headers (1, 2, 3...)
    for (let r = visible.startRow; r <= visible.endRow; r++) {
      const rect = viewport.getCellRect(r, 0);
      const headerX = 0;
      const headerY = rect.y;
      const headerW = viewport.headerColWidth;
      const headerH = rect.height;

      ctx.fillStyle = this.theme.headerBackground;
      ctx.fillRect(headerX, headerY, headerW, headerH);
      ctx.strokeStyle = this.theme.headerBorder;
      ctx.strokeRect(headerX, headerY, headerW, headerH);

      ctx.fillStyle = this.theme.headerText;
      ctx.textAlign = "center";
      ctx.fillText(String(r + 1), headerW / 2, headerY + headerH / 2);
    }

    ctx.restore();
  }
}
