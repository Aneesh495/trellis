/**
 * Core type definitions for Trellis reactive calculation engine.
 * Defines cell values, 2D matrix abstractions, coordinate geometry, and cell styling.
 */

import { TrellisError } from "./errors.js";

/**
 * Primitive cell value types supported across calculation and storage pipelines.
 */
export type PrimitiveValue = null | boolean | number | string | Date | TrellisError;

/**
 * Full cell value union including multi-dimensional matrix values.
 */
export type CellValue = PrimitiveValue | TMatrix;

/**
 * Multi-dimensional 2D matrix structure used for dynamic array calculations.
 */
export class TMatrix {
  private readonly data: PrimitiveValue[][];
  public readonly rowCount: number;
  public readonly colCount: number;

  constructor(data: PrimitiveValue[][]) {
    this.data = data;
    this.rowCount = data.length;
    this.colCount = data.length > 0 && data[0] ? data[0].length : 0;
  }

  /**
   * Creates a matrix of specified dimensions initialized with a filler value.
   */
  public static filled(rows: number, cols: number, value: PrimitiveValue = null): TMatrix {
    const data: PrimitiveValue[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: PrimitiveValue[] = new Array(cols).fill(value);
      data.push(row);
    }
    return new TMatrix(data);
  }

  /**
   * Creates a single-element 1x1 scalar matrix wrapper.
   */
  public static scalar(value: PrimitiveValue): TMatrix {
    return new TMatrix([[value]]);
  }

  /**
   * Creates a 1D row vector (1 x cols).
   */
  public static rowVector(values: PrimitiveValue[]): TMatrix {
    return new TMatrix([[...values]]);
  }

  /**
   * Creates a 1D column vector (rows x 1).
   */
  public static colVector(values: PrimitiveValue[]): TMatrix {
    return new TMatrix(values.map((v) => [v]));
  }

  /**
   * Retrieves value at 0-indexed row and column coordinates.
   */
  public get(row: number, col: number): PrimitiveValue {
    if (row < 0 || row >= this.rowCount || col < 0 || col >= this.colCount) {
      return null;
    }
    const r = this.data[row];
    return r ? r[col] ?? null : null;
  }

  /**
   * Returns a 2D deep copy of internal row arrays.
   */
  public toArray(): PrimitiveValue[][] {
    return this.data.map((row) => [...row]);
  }

  /**
   * Flattens 2D matrix into a 1D array in row-major order.
   */
  public flatten(): PrimitiveValue[] {
    const result: PrimitiveValue[] = [];
    for (let r = 0; r < this.rowCount; r++) {
      const row = this.data[r];
      if (row) {
        for (let c = 0; c < this.colCount; c++) {
          result.push(row[c] ?? null);
        }
      }
    }
    return result;
  }

  /**
   * Transposes matrix dimensions (swaps rows and columns).
   */
  public transpose(): TMatrix {
    const transposed: PrimitiveValue[][] = [];
    for (let c = 0; c < this.colCount; c++) {
      const newRow: PrimitiveValue[] = [];
      for (let r = 0; r < this.rowCount; r++) {
        const row = this.data[r];
        newRow.push(row ? (row[c] ?? null) : null);
      }
      transposed.push(newRow);
    }
    return new TMatrix(transposed);
  }

  /**
   * Extracts a sub-matrix slice based on coordinate bounds.
   */
  public slice(startRow: number, startCol: number, endRow: number, endCol: number): TMatrix {
    const sliced: PrimitiveValue[][] = [];
    const r0 = Math.max(0, startRow);
    const r1 = Math.min(this.rowCount - 1, endRow);
    const c0 = Math.max(0, startCol);
    const c1 = Math.min(this.colCount - 1, endCol);

    for (let r = r0; r <= r1; r++) {
      const row = this.data[r];
      const sliceRow: PrimitiveValue[] = [];
      for (let c = c0; c <= c1; c++) {
        sliceRow.push(row ? (row[c] ?? null) : null);
      }
      sliced.push(sliceRow);
    }
    return new TMatrix(sliced);
  }

  /**
   * Applies a mapping transformation function across every cell.
   */
  public map(fn: (val: PrimitiveValue, r: number, c: number) => PrimitiveValue): TMatrix {
    const mapped: PrimitiveValue[][] = [];
    for (let r = 0; r < this.rowCount; r++) {
      const row = this.data[r] || [];
      const newRow: PrimitiveValue[] = [];
      for (let c = 0; c < this.colCount; c++) {
        newRow.push(fn(row[c] ?? null, r, c));
      }
      mapped.push(newRow);
    }
    return new TMatrix(mapped);
  }
}

/**
 * 0-indexed cell coordinate with optional absolute reference pinning ($A$1).
 */
export interface CellCoord {
  readonly row: number;
  readonly col: number;
  readonly rowFixed?: boolean;
  readonly colFixed?: boolean;
  readonly sheet?: string;
}

/**
 * 0-indexed rectangular range coordinate covering [startRow..endRow] x [startCol..endCol].
 */
export interface RangeCoord {
  readonly startRow: number;
  readonly startCol: number;
  readonly endRow: number;
  readonly endCol: number;
  readonly startRowFixed?: boolean;
  readonly startColFixed?: boolean;
  readonly endRowFixed?: boolean;
  readonly endColFixed?: boolean;
  readonly sheet?: string;
}

/**
 * Cell visual formatting and number presentation properties.
 */
export interface CellFormat {
  readonly numberFormat?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly textColor?: string;
  readonly backgroundColor?: string;
  readonly align?: "left" | "center" | "right" | "justify";
  readonly verticalAlign?: "top" | "middle" | "bottom";
  readonly wrapText?: boolean;
}

/**
 * Cell model attributes including raw input, calculated value, and comments.
 */
export interface CellModel {
  readonly coord: CellCoord;
  formula?: string;
  value?: CellValue;
  format?: CellFormat;
  comment?: string;
  lastCalculatedAt?: number;
  isSpillRoot?: boolean;
  spillRange?: RangeCoord;
}
