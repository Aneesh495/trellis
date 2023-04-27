/**
 * Selection state management covering active cursors, rectangular ranges, and fill handle drags.
 */

import { CellCoord, RangeCoord } from "@trellis/core";

export class SelectionManager {
  public cursor: CellCoord = { row: 0, col: 0 };
  private activeRanges: RangeCoord[] = [
    { startRow: 0, startCol: 0, endRow: 0, endCol: 0 }
  ];
  public isDraggingFillHandle = false;
  public fillTargetRange: RangeCoord | null = null;

  public get primaryRange(): RangeCoord {
    return this.activeRanges[0]!;
  }

  public get allRanges(): readonly RangeCoord[] {
    return this.activeRanges;
  }

  /**
   * Sets the active cursor, optionally extending the selection range if shift is held.
   */
  public selectCell(row: number, col: number, extend = false): void {
    const target: CellCoord = { row: Math.max(0, row), col: Math.max(0, col) };

    if (!extend) {
      this.cursor = target;
      this.activeRanges = [
        {
          startRow: target.row,
          startCol: target.col,
          endRow: target.row,
          endCol: target.col
        }
      ];
    } else {
      const startRow = Math.min(this.cursor.row, target.row);
      const startCol = Math.min(this.cursor.col, target.col);
      const endRow = Math.max(this.cursor.row, target.row);
      const endCol = Math.max(this.cursor.col, target.col);

      this.activeRanges = [
        {
          startRow,
          startCol,
          endRow,
          endCol
        }
      ];
    }
  }

  /**
   * Selects an explicit rectangular range.
   */
  public selectRange(range: RangeCoord, append = false): void {
    const normalized: RangeCoord = {
      startRow: Math.min(range.startRow, range.endRow),
      startCol: Math.min(range.startCol, range.endCol),
      endRow: Math.max(range.startRow, range.endRow),
      endCol: Math.max(range.startCol, range.endCol),
      sheet: range.sheet
    };

    if (append) {
      this.activeRanges.push(normalized);
    } else {
      this.cursor = { row: normalized.startRow, col: normalized.startCol };
      this.activeRanges = [normalized];
    }
  }

  /**
   * Tests whether a coordinate falls inside any active selection range.
   */
  public isSelected(row: number, col: number): boolean {
    for (const r of this.activeRanges) {
      if (row >= r.startRow && row <= r.endRow && col >= r.startCol && col <= r.endCol) {
        return true;
      }
    }
    return false;
  }

  /**
   * Starts a fill handle drag sequence from the primary selection.
   */
  public startFillDrag(): void {
    this.isDraggingFillHandle = true;
    this.fillTargetRange = { ...this.primaryRange };
  }

  /**
   * Updates the projected fill range during mouse drag.
   */
  public updateFillDrag(coord: CellCoord): RangeCoord | null {
    if (!this.isDraggingFillHandle) return null;

    const base = this.primaryRange;
    let targetRow = coord.row;
    let targetCol = coord.col;

    // Constrain to dominant axis (vertical or horizontal)
    const dRow = Math.abs(coord.row - base.endRow);
    const dCol = Math.abs(coord.col - base.endCol);

    if (dRow >= dCol) {
      targetCol = base.endCol;
      targetRow = Math.max(base.endRow, coord.row);
    } else {
      targetRow = base.endRow;
      targetCol = Math.max(base.endCol, coord.col);
    }

    this.fillTargetRange = {
      startRow: base.startRow,
      startCol: base.startCol,
      endRow: targetRow,
      endCol: targetCol
    };

    return this.fillTargetRange;
  }

  /**
   * Commits the fill handle drag sequence, returning the completed target range.
   */
  public commitFillDrag(): RangeCoord | null {
    if (!this.isDraggingFillHandle) return null;
    const committed = this.fillTargetRange;
    this.isDraggingFillHandle = false;
    this.fillTargetRange = null;
    if (committed) {
      this.selectRange(committed);
    }
    return committed;
  }
}
