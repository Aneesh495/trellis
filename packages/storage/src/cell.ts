/**
 * Cell entity model storing formula text, evaluation state, format tags, and comments.
 */

import { CellCoord, RangeCoord, CellValue, CellFormat, formatCellRef } from "@trellis/core";
import { ASTNode } from "@trellis/parser";

export class Cell {
  public readonly coord: CellCoord;
  public raw = "";
  public formula?: string;
  public ast?: ASTNode;
  public value: CellValue = null;
  public format?: CellFormat;
  public comment?: string;
  public lastCalculatedAt?: number;
  public isSpillRoot = false;
  public spillRange?: RangeCoord;
  public dirty = false;

  constructor(coord: CellCoord) {
    this.coord = coord;
  }

  public get key(): string {
    return formatCellRef(this.coord).toUpperCase();
  }

  public setInput(input: string): void {
    this.raw = input;
    const trimmed = input.trim();
    if (trimmed.startsWith("=") || trimmed.startsWith("+")) {
      this.formula = trimmed;
      this.dirty = true;
    } else {
      this.formula = undefined;
      this.ast = undefined;
      this.dirty = true;
      // Primitive parsing
      if (trimmed === "") {
        this.value = null;
      } else if (trimmed.toUpperCase() === "TRUE") {
        this.value = true;
      } else if (trimmed.toUpperCase() === "FALSE") {
        this.value = false;
      } else {
        const num = Number(trimmed);
        this.value = !isNaN(num) ? num : input;
      }
    }
  }

  public clear(): void {
    this.raw = "";
    this.formula = undefined;
    this.ast = undefined;
    this.value = null;
    this.isSpillRoot = false;
    this.spillRange = undefined;
    this.dirty = true;
  }
}
