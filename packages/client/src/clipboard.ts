/**
 * Clipboard operations handling TSV copy-paste and formula coordinate shifting.
 */

import { RangeCoord, CellCoord } from "@trellis/core";
import { TrellisEngine } from "@trellis/engine";
import { Parser, decompile, walkAST } from "@trellis/parser";

export interface ClipboardPayload {
  readonly tsv: string;
  readonly range: RangeCoord;
  readonly formulas: (string | undefined)[][];
  readonly raws: string[][];
}

export class ClipboardManager {
  /**
   * Generates clipboard payload from the specified selection range.
   */
  public copyRange(engine: TrellisEngine, sheetName: string, range: RangeCoord): ClipboardPayload {
    const r0 = Math.min(range.startRow, range.endRow);
    const r1 = Math.max(range.startRow, range.endRow);
    const c0 = Math.min(range.startCol, range.endCol);
    const c1 = Math.max(range.startCol, range.endCol);

    const rows = r1 - r0 + 1;
    const cols = c1 - c0 + 1;

    const tsvLines: string[] = [];
    const formulas: (string | undefined)[][] = [];
    const raws: string[][] = [];

    for (let r = 0; r < rows; r++) {
      const rowTokens: string[] = [];
      const formulaRow: (string | undefined)[] = [];
      const rawRow: string[] = [];

      for (let c = 0; c < cols; c++) {
        const actualRow = r0 + r;
        const actualCol = c0 + c;

        const raw = engine.getCellRaw(sheetName, { row: actualRow, col: actualCol });
        const formula = engine.getCellFormula(sheetName, { row: actualRow, col: actualCol });

        rowTokens.push(raw);
        formulaRow.push(formula);
        rawRow.push(raw);
      }

      tsvLines.push(rowTokens.join("\t"));
      formulas.push(formulaRow);
      raws.push(rawRow);
    }

    return {
      tsv: tsvLines.join("\n"),
      range: { startRow: r0, startCol: c0, endRow: r1, endCol: c1, sheet: sheetName },
      formulas,
      raws
    };
  }

  /**
   * Applies clipboard text or structured payload at the target cursor coordinate.
   */
  public paste(
    engine: TrellisEngine,
    sheetName: string,
    targetCoord: CellCoord,
    clipboardData: string | ClipboardPayload
  ): RangeCoord {
    let formulas: (string | undefined)[][];
    let raws: string[][];
    let srcOrigin: CellCoord | undefined;

    if (typeof clipboardData === "string") {
      const parsed = this.parseTsv(clipboardData);
      raws = parsed;
      formulas = parsed.map((row) =>
        row.map((val) => (val.startsWith("=") ? val : undefined))
      );
    } else {
      raws = clipboardData.raws;
      formulas = clipboardData.formulas;
      srcOrigin = {
        row: clipboardData.range.startRow,
        col: clipboardData.range.startCol
      };
    }

    const rowCount = raws.length;
    const colCount = rowCount > 0 && raws[0] ? raws[0].length : 0;

    engine.batch((b) => {
      for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < colCount; c++) {
          const dstRow = targetCoord.row + r;
          const dstCol = targetCoord.col + c;
          const target: CellCoord = { row: dstRow, col: dstCol, sheet: sheetName };

          const f = formulas[r]?.[c];
          if (f && srcOrigin) {
            // Shift formula references relative to origin
            const dRow = dstRow - (srcOrigin.row + r);
            const dCol = dstCol - (srcOrigin.col + c);
            const shifted = this.shiftFormulaReferences(f, dRow, dCol);
            b.setCell(sheetName, target, shifted);
          } else {
            const rawVal = raws[r]?.[c] ?? "";
            b.setCell(sheetName, target, rawVal);
          }
        }
      }
    });

    return {
      startRow: targetCoord.row,
      startCol: targetCoord.col,
      endRow: targetCoord.row + rowCount - 1,
      endCol: targetCoord.col + colCount - 1,
      sheet: sheetName
    };
  }

  /**
   * Shifts relative cell and range references in a formula by delta rows and delta columns.
   */
  public shiftFormulaReferences(formula: string, deltaRow: number, deltaCol: number): string {
    if (deltaRow === 0 && deltaCol === 0) return formula;

    try {
      const ast = Parser.parse(formula);

      walkAST(ast, (node) => {
        if (node.type === "Cell") {
          const c = node.coord;
          const newRow = c.rowFixed ? c.row : Math.max(0, c.row + deltaRow);
          const newCol = c.colFixed ? c.col : Math.max(0, c.col + deltaCol);
          (node as { coord: CellCoord }).coord = { ...c, row: newRow, col: newCol };
        } else if (node.type === "Range") {
          const r = node.range;
          const startRow = r.startRowFixed ? r.startRow : Math.max(0, r.startRow + deltaRow);
          const startCol = r.startColFixed ? r.startCol : Math.max(0, r.startCol + deltaCol);
          const endRow = r.endRowFixed ? r.endRow : Math.max(0, r.endRow + deltaRow);
          const endCol = r.endColFixed ? r.endCol : Math.max(0, r.endCol + deltaCol);
          (node as { range: RangeCoord }).range = {
            ...r,
            startRow,
            startCol,
            endRow,
            endCol
          };
        }
      });

      return `=${decompile(ast)}`;
    } catch {
      // Fallback if parsing fails
      return formula;
    }
  }

  private parseTsv(text: string): string[][] {
    const lines = text.split(/\r?\n/);
    // Remove trailing empty line if present
    if (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }
    return lines.map((line) => line.split("\t"));
  }
}
