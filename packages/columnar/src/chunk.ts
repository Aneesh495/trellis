/**
 * Chunked columnar memory buffers with Float64Array backing, Dictionary encoding, and RLE compression.
 */

import { PrimitiveValue, TrellisError, coerceToNumber } from "@trellis/core";
import { NullBitMask } from "./null_mask.js";
import { ZoneMap } from "./zonemap.js";

export const CHUNK_SIZE = 1024;

export type ChunkType = "FLOAT64" | "DICTIONARY" | "RLE" | "GENERIC";

export interface ColumnChunk {
  readonly type: ChunkType;
  readonly nullMask: NullBitMask;
  readonly zoneMap: ZoneMap;
  get(offset: number): PrimitiveValue;
  set(offset: number, value: PrimitiveValue): void;
  recomputeZoneMap(): void;
}

/**
 * High-performance Float64 typed array buffer chunk.
 */
export class Float64Chunk implements ColumnChunk {
  public readonly type: ChunkType = "FLOAT64";
  public readonly data: Float64Array = new Float64Array(CHUNK_SIZE);
  public readonly nullMask: NullBitMask = new NullBitMask(CHUNK_SIZE);
  public readonly zoneMap: ZoneMap = new ZoneMap();

  constructor() {
    this.nullMask.fillAllNull();
    this.recomputeZoneMap();
  }

  public get(offset: number): PrimitiveValue {
    if (this.nullMask.isNull(offset)) {
      return null;
    }
    return this.data[offset]!;
  }

  public set(offset: number, value: PrimitiveValue): void {
    if (value === null || value === undefined || value === "") {
      this.nullMask.setNull(offset, true);
      this.data[offset] = 0;
    } else if (typeof value === "number") {
      this.nullMask.setNull(offset, false);
      this.data[offset] = value;
    } else if (TrellisError.isError(value)) {
      this.nullMask.setNull(offset, true);
      this.zoneMap.recordError();
    } else {
      try {
        const num = coerceToNumber(value);
        this.nullMask.setNull(offset, false);
        this.data[offset] = num;
      } catch {
        this.nullMask.setNull(offset, true);
      }
    }
    this.recomputeZoneMap();
  }

  public recomputeZoneMap(): void {
    this.zoneMap.reset();
    for (let i = 0; i < CHUNK_SIZE; i++) {
      if (this.nullMask.isNull(i)) {
        this.zoneMap.recordNull();
      } else {
        this.zoneMap.recordValue(this.data[i]!);
      }
    }
  }
}

/**
 * Dictionary-encoded chunk for low-cardinality string columns.
 */
export class DictionaryChunk implements ColumnChunk {
  public readonly type: ChunkType = "DICTIONARY";
  public readonly dictionary: string[] = [];
  private readonly dictMap: Map<string, number> = new Map();
  public readonly indices: Uint16Array = new Uint16Array(CHUNK_SIZE);
  public readonly nullMask: NullBitMask = new NullBitMask(CHUNK_SIZE);
  public readonly zoneMap: ZoneMap = new ZoneMap();

  constructor() {
    this.nullMask.fillAllNull();
    this.recomputeZoneMap();
  }

  public get(offset: number): PrimitiveValue {
    if (this.nullMask.isNull(offset)) return null;
    const code = this.indices[offset]!;
    return this.dictionary[code] ?? null;
  }

  public set(offset: number, value: PrimitiveValue): void {
    if (value === null || value === undefined || value === "") {
      this.nullMask.setNull(offset, true);
      this.indices[offset] = 0;
    } else {
      const str = String(value);
      let code = this.dictMap.get(str);
      if (code === undefined) {
        code = this.dictionary.length;
        this.dictionary.push(str);
        this.dictMap.set(str, code);
      }
      this.nullMask.setNull(offset, false);
      this.indices[offset] = code;
    }
    this.recomputeZoneMap();
  }

  public recomputeZoneMap(): void {
    this.zoneMap.reset();
    for (let i = 0; i < CHUNK_SIZE; i++) {
      if (this.nullMask.isNull(i)) {
        this.zoneMap.recordNull();
      } else {
        const code = this.indices[i]!;
        this.zoneMap.recordValue(code);
      }
    }
  }
}

/**
 * Generic chunk container for polymorphic or complex objects.
 */
export class GenericChunk implements ColumnChunk {
  public readonly type: ChunkType = "GENERIC";
  public readonly data: PrimitiveValue[] = new Array(CHUNK_SIZE).fill(null);
  public readonly nullMask: NullBitMask = new NullBitMask(CHUNK_SIZE);
  public readonly zoneMap: ZoneMap = new ZoneMap();

  constructor() {
    this.nullMask.fillAllNull();
    this.recomputeZoneMap();
  }

  public get(offset: number): PrimitiveValue {
    if (this.nullMask.isNull(offset)) return null;
    return this.data[offset] ?? null;
  }

  public set(offset: number, value: PrimitiveValue): void {
    if (value === null || value === undefined || value === "") {
      this.nullMask.setNull(offset, true);
      this.data[offset] = null;
    } else {
      this.nullMask.setNull(offset, false);
      this.data[offset] = value;
    }
    this.recomputeZoneMap();
  }

  public recomputeZoneMap(): void {
    this.zoneMap.reset();
    for (let i = 0; i < CHUNK_SIZE; i++) {
      const v = this.data[i];
      if (v === null || v === undefined) {
        this.zoneMap.recordNull();
      } else if (typeof v === "number") {
        this.zoneMap.recordValue(v);
      } else if (TrellisError.isError(v)) {
        this.zoneMap.recordError();
      } else {
        this.zoneMap.count++;
      }
    }
  }
}
