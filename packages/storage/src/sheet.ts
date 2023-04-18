/**
 * Sheet model container managing sparse cell grids, dimensions, and freeze panes.
 */

import { Cell } from "./cell.js";
import { CellCoord, CellValue } from "@trellis/core";

export class Sheet {
  public name: string;
  private readonly cells: Map<string, Cell> = new Map();
  public columnWidths: Map<number, number> = new Map();
  public rowHeights: Map<number, number> = new Map();
  public freezeRows = 0;
  public freezeCols = 0;
  public hiddenRows: Set<number> = new Set();
  public hiddenCols: Set<number> = new Set();

  constructor(name: string) {
    this.name = name;
  }

  public static cellKey(row: number, col: number): string {
    return `${row}:${col}`;
  }

  public getCell(row: number, col: number): Cell | undefined {
    return this.cells.get(Sheet.cellKey(row, col));
  }

  public getOrCreateCell(row: number, col: number): Cell {
    const key = Sheet.cellKey(row, col);
    let cell = this.cells.get(key);
    if (!cell) {
      const coord: CellCoord = { row, col, sheet: this.name };
      cell = new Cell(coord);
      this.cells.set(key, cell);
    }
    return cell;
  }

  public setCellInput(row: number, col: number, input: string): Cell {
    const cell = this.getOrCreateCell(row, col);
    cell.setInput(input);
    return cell;
  }

  public setCellValue(row: number, col: number, value: CellValue): Cell {
    const cell = this.getOrCreateCell(row, col);
    cell.value = value;
    cell.raw = String(value ?? "");
    cell.formula = undefined;
    cell.ast = undefined;
    cell.dirty = true;
    return cell;
  }

  public removeCell(row: number, col: number): void {
    this.cells.delete(Sheet.cellKey(row, col));
  }

  public getAllCells(): Cell[] {
    return Array.from(this.cells.values());
  }

  public getBounds(): { maxRow: number; maxCol: number } {
    let maxRow = 0;
    let maxCol = 0;
    for (const cell of this.cells.values()) {
      if (cell.coord.row > maxRow) maxRow = cell.coord.row;
      if (cell.coord.col > maxCol) maxCol = cell.coord.col;
    }
    return { maxRow, maxCol };
  }

  public clear(): void {
    this.cells.clear();
  }
}
