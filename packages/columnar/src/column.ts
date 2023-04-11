/**
 * Column data container composed of indexed 1024-cell memory chunks.
 */

import { PrimitiveValue } from "@trellis/core";
import { CHUNK_SIZE, ColumnChunk, Float64Chunk, DictionaryChunk, GenericChunk } from "./chunk.js";

export class Column {
  public readonly colIndex: number;
  public readonly chunks: Map<number, ColumnChunk> = new Map();

  constructor(colIndex: number) {
    this.colIndex = colIndex;
  }

  public get(row: number): PrimitiveValue {
    const chunkIdx = Math.floor(row / CHUNK_SIZE);
    const offset = row % CHUNK_SIZE;
    const chunk = this.chunks.get(chunkIdx);
    if (!chunk) return null;
    return chunk.get(offset);
  }

  public set(row: number, value: PrimitiveValue): void {
    const chunkIdx = Math.floor(row / CHUNK_SIZE);
    const offset = row % CHUNK_SIZE;
    let chunk = this.chunks.get(chunkIdx);

    if (!chunk) {
      if (typeof value === "number") {
        chunk = new Float64Chunk();
      } else if (typeof value === "string") {
        chunk = new DictionaryChunk();
      } else {
        chunk = new GenericChunk();
      }
      this.chunks.set(chunkIdx, chunk);
    } else {
      // Type promotion: if Float64Chunk receives string, promote to GenericChunk
      if (chunk.type === "FLOAT64" && typeof value === "string") {
        const generic = new GenericChunk();
        for (let i = 0; i < CHUNK_SIZE; i++) {
          generic.set(i, chunk.get(i));
        }
        chunk = generic;
        this.chunks.set(chunkIdx, chunk);
      }
    }

    chunk.set(offset, value);
  }

  public getChunk(chunkIndex: number): ColumnChunk | undefined {
    return this.chunks.get(chunkIndex);
  }

  public clear(): void {
    this.chunks.clear();
  }
}

/**
 * High-density tabular columnar storage matrix.
 */
export class ColumnarTable {
  private readonly columns: Map<number, Column> = new Map();

  public get(row: number, col: number): PrimitiveValue {
    const column = this.columns.get(col);
    if (!column) return null;
    return column.get(row);
  }

  public set(row: number, col: number, value: PrimitiveValue): void {
    let column = this.columns.get(col);
    if (!column) {
      column = new Column(col);
      this.columns.set(col, column);
    }
    column.set(row, value);
  }

  public getColumn(col: number): Column | undefined {
    return this.columns.get(col);
  }

  public clear(): void {
    this.columns.clear();
  }
}
