/**
 * Evaluation context interface and lightweight in-memory reference resolver.
 */

import { CellCoord, RangeCoord, CellValue, TMatrix, formatCellRef, TrellisError } from "@trellis/core";

export interface EvaluationContext {
  getCellValue(coord: CellCoord): CellValue;
  getRangeValues(range: RangeCoord): TMatrix;
  getSpillRange(root: CellCoord): TMatrix;
  resolveNamedRange?(name: string): RangeCoord | CellCoord | CellValue | undefined;
  callFunction?(name: string, args: CellValue[], ctx: EvaluationContext): CellValue;
  readonly currentCell?: CellCoord;
}

/**
 * Lightweight in-memory evaluation context backed by a Map.
 * Ideal for unit testing, isolated formula execution, and microbenchmarks.
 */
export class SimpleEvaluationContext implements EvaluationContext {
  private readonly cellData: Map<string, CellValue> = new Map();
  private readonly spillData: Map<string, TMatrix> = new Map();
  private readonly functionRegistry: Map<string, (args: CellValue[], ctx: EvaluationContext) => CellValue> = new Map();
  public readonly currentCell?: CellCoord;

  constructor(currentCell?: CellCoord) {
    this.currentCell = currentCell;
  }

  public setCellValue(ref: string | CellCoord, value: CellValue): void {
    const key = typeof ref === "string" ? ref.toUpperCase() : formatCellRef(ref).toUpperCase();
    this.cellData.set(key, value);
  }

  public getCellValue(coord: CellCoord): CellValue {
    const key = formatCellRef(coord).toUpperCase();
    return this.cellData.has(key) ? this.cellData.get(key)! : null;
  }

  public setSpillRange(rootRef: string | CellCoord, matrix: TMatrix): void {
    const key = typeof rootRef === "string" ? rootRef.toUpperCase() : formatCellRef(rootRef).toUpperCase();
    this.spillData.set(key, matrix);
  }

  public getSpillRange(root: CellCoord): TMatrix {
    const key = formatCellRef(root).toUpperCase();
    if (this.spillData.has(key)) {
      return this.spillData.get(key)!;
    }
    const val = this.getCellValue(root);
    if (val instanceof TMatrix) {
      return val;
    }
    return TMatrix.scalar(val as any);
  }

  public getRangeValues(range: RangeCoord): TMatrix {
    const rows = range.endRow - range.startRow + 1;
    const cols = range.endCol - range.startCol + 1;
    const matrixData: any[][] = [];

    for (let r = 0; r < rows; r++) {
      const rowArr: any[] = [];
      for (let c = 0; c < cols; c++) {
        const coord: CellCoord = {
          row: range.startRow + r,
          col: range.startCol + c,
          sheet: range.sheet
        };
        rowArr.push(this.getCellValue(coord));
      }
      matrixData.push(rowArr);
    }

    return new TMatrix(matrixData);
  }

  public registerFunction(name: string, fn: (args: CellValue[], ctx: EvaluationContext) => CellValue): void {
    this.functionRegistry.set(name.toUpperCase(), fn);
  }

  public callFunction(name: string, args: CellValue[], ctx: EvaluationContext): CellValue {
    const fn = this.functionRegistry.get(name.toUpperCase());
    if (!fn) {
      throw TrellisError.nameError(`Function '${name}' is not registered`);
    }
    return fn(args, ctx);
  }
}
