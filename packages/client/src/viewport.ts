/**
 * Viewport geometry, coordinate projection, and spatial slicing for virtualized grid rendering.
 */

import { RangeCoord } from "@trellis/core";

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface VisibleRange {
  readonly startRow: number;
  readonly endRow: number;
  readonly startCol: number;
  readonly endCol: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface HitTestResult {
  readonly row: number;
  readonly col: number;
  readonly isHeaderRow: boolean;
  readonly isHeaderCol: boolean;
}

export class ViewportManager {
  public defaultRowHeight = 24;
  public defaultColWidth = 100;
  public headerColWidth = 46;
  public headerRowHeight = 24;

  public scrollX = 0;
  public scrollY = 0;
  public viewportWidth = 1024;
  public viewportHeight = 768;

  public readonly customColWidths: Map<number, number> = new Map();
  public readonly customRowHeights: Map<number, number> = new Map();

  constructor(width = 1024, height = 768) {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  public getColWidth(col: number): number {
    return this.customColWidths.get(col) ?? this.defaultColWidth;
  }

  public getRowHeight(row: number): number {
    return this.customRowHeights.get(row) ?? this.defaultRowHeight;
  }

  public setColWidth(col: number, width: number): void {
    this.customColWidths.set(col, Math.max(20, width));
  }

  public setRowHeight(row: number, height: number): void {
    this.customRowHeights.set(row, Math.max(16, height));
  }

  /**
   * Computes the visible range of cells given current scroll position and canvas dimensions.
   */
  public computeVisibleRange(): VisibleRange {
    const dataAreaWidth = this.viewportWidth - this.headerColWidth;
    const dataAreaHeight = this.viewportHeight - this.headerRowHeight;

    // Determine start column
    let curX = 0;
    let startCol = 0;
    while (curX + this.getColWidth(startCol) <= this.scrollX) {
      curX += this.getColWidth(startCol);
      startCol++;
    }
    const offsetX = curX - this.scrollX;

    // Determine end column
    let endCol = startCol;
    let spanX = offsetX;
    while (spanX < dataAreaWidth) {
      spanX += this.getColWidth(endCol);
      endCol++;
    }

    // Determine start row
    let curY = 0;
    let startRow = 0;
    while (curY + this.getRowHeight(startRow) <= this.scrollY) {
      curY += this.getRowHeight(startRow);
      startRow++;
    }
    const offsetY = curY - this.scrollY;

    // Determine end row
    let endRow = startRow;
    let spanY = offsetY;
    while (spanY < dataAreaHeight) {
      spanY += this.getRowHeight(endRow);
      endRow++;
    }

    return {
      startRow,
      endRow,
      startCol,
      endCol,
      offsetX,
      offsetY
    };
  }

  /**
   * Translates 0-indexed cell coordinates into canvas pixel bounding box.
   */
  public getCellRect(row: number, col: number): Rect {
    let x = this.headerColWidth - this.scrollX;
    for (let c = 0; c < col; c++) {
      x += this.getColWidth(c);
    }

    let y = this.headerRowHeight - this.scrollY;
    for (let r = 0; r < row; r++) {
      y += this.getRowHeight(r);
    }

    return {
      x,
      y,
      width: this.getColWidth(col),
      height: this.getRowHeight(row)
    };
  }

  /**
   * Translates a rectangular range into a single unified pixel bounding box.
   */
  public getRangeRect(range: RangeCoord): Rect {
    const topLeft = this.getCellRect(range.startRow, range.startCol);
    const bottomRight = this.getCellRect(range.endRow, range.endCol);

    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x + bottomRight.width - topLeft.x,
      height: bottomRight.y + bottomRight.height - topLeft.y
    };
  }

  /**
   * Projects canvas pixel coordinates to cell grid coordinates with header detection.
   */
  public hitTest(pixelX: number, pixelY: number): HitTestResult {
    const isHeaderCol = pixelX < this.headerColWidth;
    const isHeaderRow = pixelY < this.headerRowHeight;

    let targetCol = 0;
    let accumulatedX = this.headerColWidth - this.scrollX;
    while (accumulatedX + this.getColWidth(targetCol) < pixelX) {
      accumulatedX += this.getColWidth(targetCol);
      targetCol++;
    }

    let targetRow = 0;
    let accumulatedY = this.headerRowHeight - this.scrollY;
    while (accumulatedY + this.getRowHeight(targetRow) < pixelY) {
      accumulatedY += this.getRowHeight(targetRow);
      targetRow++;
    }

    return {
      row: Math.max(0, targetRow),
      col: Math.max(0, targetCol),
      isHeaderRow,
      isHeaderCol
    };
  }
}
