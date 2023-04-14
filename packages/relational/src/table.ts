/**
 * Relational table schema definitions, record iterators, and row projections.
 */

import { PrimitiveValue, TMatrix } from "@trellis/core";

export interface ColumnSchema {
  readonly name: string;
  readonly type: "string" | "number" | "boolean" | "date" | "any";
}

export type TableRow = Record<string, PrimitiveValue>;

export class RelationalTable {
  public readonly columns: string[];
  public readonly rows: TableRow[];

  constructor(columns: string[], rows: TableRow[] = []) {
    this.columns = columns;
    this.rows = rows;
  }

  public static fromMatrix(matrix: TMatrix, headers?: string[]): RelationalTable {
    const rowCount = matrix.rowCount;
    const colCount = matrix.colCount;
    if (rowCount === 0 || colCount === 0) {
      return new RelationalTable([]);
    }

    let startRow = 0;
    let colNames: string[] = [];

    if (headers && headers.length === colCount) {
      colNames = [...headers];
    } else {
      // First row as header
      for (let c = 0; c < colCount; c++) {
        const val = matrix.get(0, c);
        colNames.push(val !== null && val !== undefined ? String(val) : `Col_${c + 1}`);
      }
      startRow = 1;
    }

    const rows: TableRow[] = [];
    for (let r = startRow; r < rowCount; r++) {
      const rowObj: TableRow = {};
      for (let c = 0; c < colCount; c++) {
        rowObj[colNames[c]!] = matrix.get(r, c);
      }
      rows.push(rowObj);
    }

    return new RelationalTable(colNames, rows);
  }

  public toMatrix(includeHeaders = true): TMatrix {
    const data: PrimitiveValue[][] = [];
    if (includeHeaders) {
      data.push(this.columns.map((c) => c));
    }
    for (const row of this.rows) {
      const rowArr: PrimitiveValue[] = [];
      for (const col of this.columns) {
        rowArr.push(row[col] ?? null);
      }
      data.push(rowArr);
    }
    return new TMatrix(data);
  }

  public project(selectedColumns: string[]): RelationalTable {
    const projectedRows = this.rows.map((row) => {
      const newRow: TableRow = {};
      for (const col of selectedColumns) {
        newRow[col] = row[col] ?? null;
      }
      return newRow;
    });
    return new RelationalTable(selectedColumns, projectedRows);
  }

  public filter(predicate: (row: TableRow) => boolean): RelationalTable {
    return new RelationalTable(this.columns, this.rows.filter(predicate));
  }

  public rowCount(): number {
    return this.rows.length;
  }
}
