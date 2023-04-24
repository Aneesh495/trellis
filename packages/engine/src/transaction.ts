/**
 * Batch transaction manager enabling atomic multi-cell mutations and deferred recalculation.
 */

import { CellCoord, CellFormat } from "@trellis/core";

export interface CellMutation {
  type: "set_cell" | "clear_cell" | "set_format";
  sheetName: string;
  coord: CellCoord;
  rawInput?: string;
  format?: CellFormat;
}

export class TransactionBatch {
  private readonly mutations: CellMutation[] = [];
  public readonly id: string;
  public readonly startedAt: number;

  constructor(id?: string) {
    this.id = id || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.startedAt = Date.now();
  }

  public setCell(sheetName: string, coord: CellCoord, rawInput: string): this {
    this.mutations.push({
      type: "set_cell",
      sheetName,
      coord,
      rawInput
    });
    return this;
  }

  public clearCell(sheetName: string, coord: CellCoord): this {
    this.mutations.push({
      type: "clear_cell",
      sheetName,
      coord
    });
    return this;
  }

  public setFormat(sheetName: string, coord: CellCoord, format: CellFormat): this {
    this.mutations.push({
      type: "set_format",
      sheetName,
      coord,
      format
    });
    return this;
  }

  public getMutations(): readonly CellMutation[] {
    return this.mutations;
  }

  public get size(): number {
    return this.mutations.length;
  }
}
