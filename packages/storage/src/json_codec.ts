/**
 * JSON workbook serializer and schema migrator.
 */

import { Workbook } from "./workbook.js";
import { Sheet } from "./sheet.js";
import { RangeCoord } from "@trellis/core";

export class JsonCodec {
  public static serialize(workbook: Workbook, pretty = true): string {
    const obj = {
      trellisVersion: "1.0",
      activeSheet: workbook.activeSheetIndex,
      options: workbook.calculationOptions,
      namedRanges: Array.from(workbook.namedRanges.entries()).map(([name, range]) => ({
        name,
        range
      })),
      sheets: workbook.sheets.map((s) => ({
        name: s.name,
        freezeRows: s.freezeRows,
        freezeCols: s.freezeCols,
        cells: s.getAllCells().map((c) => ({
          coord: c.coord,
          raw: c.raw,
          value: c.value,
          format: c.format,
          comment: c.comment
        }))
      }))
    };

    return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
  }

  public static deserialize(jsonString: string): Workbook {
    const data = JSON.parse(jsonString);
    const workbook = new Workbook(data.sheets[0]?.name || "Sheet1");
    workbook.clear();

    workbook.activeSheetIndex = data.activeSheet || 0;
    if (data.options) {
      workbook.calculationOptions = { ...data.options };
    }

    if (data.namedRanges) {
      for (const nr of data.namedRanges) {
        workbook.setNamedRange(nr.name, nr.range as RangeCoord);
      }
    }

    for (const sData of data.sheets) {
      const sheet = new Sheet(sData.name);
      sheet.freezeRows = sData.freezeRows || 0;
      sheet.freezeCols = sData.freezeCols || 0;

      for (const cData of sData.cells) {
        const cell = sheet.getOrCreateCell(cData.coord.row, cData.coord.col);
        cell.setInput(cData.raw);
        if (cData.value !== undefined) cell.value = cData.value;
        if (cData.format) cell.format = cData.format;
        if (cData.comment) cell.comment = cData.comment;
      }

      workbook.sheets.push(sheet);
    }

    return workbook;
  }
}
