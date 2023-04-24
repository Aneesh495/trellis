/**
 * Workbook evaluation context bridging runtime bytecode VM with storage, graph, and spill subsystems.
 */

import {
  CellCoord,
  RangeCoord,
  CellValue,
  PrimitiveValue,
  TMatrix,
  TrellisError
} from "@trellis/core";
import { EvaluationContext } from "@trellis/runtime";
import { FunctionRegistry } from "@trellis/functions";
import { Workbook } from "@trellis/storage";
import { SpillManager } from "@trellis/spill";

export class WorkbookEvaluationContext implements EvaluationContext {
  private readonly workbook: Workbook;
  private readonly spillManager: SpillManager;
  public readonly currentCell?: CellCoord;
  private readonly defaultSheetName: string;

  constructor(
    workbook: Workbook,
    spillManager: SpillManager,
    currentCell?: CellCoord,
    defaultSheetName?: string
  ) {
    this.workbook = workbook;
    this.spillManager = spillManager;
    this.currentCell = currentCell;
    this.defaultSheetName =
      defaultSheetName || currentCell?.sheet || workbook.activeSheet.name;
  }

  /**
   * Resolves the cell coordinate to its calculated value, honoring dynamic array spills.
   */
  public getCellValue(coord: CellCoord): CellValue {
    const sheetName = coord.sheet || this.defaultSheetName;
    const scopedCoord: CellCoord = { ...coord, sheet: sheetName };

    // 1. Check if this coordinate falls inside an active dynamic array spill
    if (this.spillManager.isGhostCell(scopedCoord)) {
      return this.spillManager.getSpillValue(scopedCoord);
    }

    const sheet = this.workbook.getSheet(sheetName);
    if (!sheet) {
      return TrellisError.refError(`Sheet '${sheetName}' not found`);
    }

    const cell = sheet.getCell(coord.row, coord.col);
    if (!cell) {
      return null;
    }

    return cell.value;
  }

  /**
   * Slices a 2D rectangular matrix of values across the specified range coordinate.
   */
  public getRangeValues(range: RangeCoord): TMatrix {
    const sheetName = range.sheet || this.defaultSheetName;
    const sheet = this.workbook.getSheet(sheetName);

    const r0 = Math.min(range.startRow, range.endRow);
    const r1 = Math.max(range.startRow, range.endRow);
    const c0 = Math.min(range.startCol, range.endCol);
    const c1 = Math.max(range.startCol, range.endCol);

    const rows = r1 - r0 + 1;
    const cols = c1 - c0 + 1;

    const data: PrimitiveValue[][] = [];

    for (let r = 0; r < rows; r++) {
      const rowArr: PrimitiveValue[] = [];
      const actualRow = r0 + r;

      for (let c = 0; c < cols; c++) {
        const actualCol = c0 + c;
        const cellCoord: CellCoord = {
          row: actualRow,
          col: actualCol,
          sheet: sheetName
        };

        if (this.spillManager.isGhostCell(cellCoord)) {
          rowArr.push(this.spillManager.getSpillValue(cellCoord));
        } else if (!sheet) {
          rowArr.push(TrellisError.refError(`Sheet '${sheetName}' not found`));
        } else {
          const cell = sheet.getCell(actualRow, actualCol);
          if (!cell || cell.value === null || cell.value === undefined) {
            rowArr.push(null);
          } else if (cell.value instanceof TMatrix) {
            rowArr.push(cell.value.get(0, 0));
          } else {
            rowArr.push(cell.value);
          }
        }
      }
      data.push(rowArr);
    }

    return new TMatrix(data);
  }

  /**
   * Retrieves the dynamic array matrix spilling outward from the given root coordinate.
   */
  public getSpillRange(root: CellCoord): TMatrix {
    const sheetName = root.sheet || this.defaultSheetName;
    const scopedRoot: CellCoord = { ...root, sheet: sheetName };

    const matrix = this.spillManager.getSpillMatrix(scopedRoot);
    if (matrix) {
      return matrix;
    }

    const val = this.getCellValue(scopedRoot);
    if (val instanceof TMatrix) {
      return val;
    }
    return TMatrix.scalar(val as PrimitiveValue);
  }

  /**
   * Resolves a named range identifier registered in the workbook.
   */
  public resolveNamedRange(name: string): RangeCoord | CellCoord | CellValue | undefined {
    const upper = name.toUpperCase();
    const range = this.workbook.namedRanges.get(upper);
    if (range) {
      return range;
    }
    return undefined;
  }

  /**
   * Executes a registered standard library or user-defined function.
   */
  public callFunction(name: string, args: CellValue[], ctx: EvaluationContext): CellValue {
    const upper = name.toUpperCase();
    const meta = FunctionRegistry.getInstance().get(upper);

    if (!meta) {
      return TrellisError.nameError(`Unknown function: ${name}`);
    }

    if (args.length < meta.minArgs || (meta.maxArgs >= 0 && args.length > meta.maxArgs)) {
      return TrellisError.valueError(
        `Function ${upper} expects between ${meta.minArgs} and ${meta.maxArgs} arguments, received ${args.length}`
      );
    }

    try {
      return meta.fn(args, ctx);
    } catch (err) {
      if (err instanceof TrellisError) {
        return err;
      }
      return TrellisError.valueError(
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}
