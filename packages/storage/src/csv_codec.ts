/**
 * RFC 4180 streaming CSV and TSV serializer and deserializer.
 */

import { Sheet } from "./sheet.js";
import { coerceToString } from "@trellis/core";

export class CsvCodec {
  /**
   * Serializes a Sheet into an RFC 4180 compliant CSV or TSV string.
   */
  public static serialize(sheet: Sheet, delimiter = ","): string {
    const { maxRow, maxCol } = sheet.getBounds();
    const lines: string[] = [];

    for (let r = 0; r <= maxRow; r++) {
      const rowTokens: string[] = [];
      for (let c = 0; c <= maxCol; c++) {
        const cell = sheet.getCell(r, c);
        const valStr = cell ? (cell.formula || coerceToString(cell.value)) : "";

        // Check if quoting is needed
        if (valStr.includes(delimiter) || valStr.includes('"') || valStr.includes("\n") || valStr.includes("\r")) {
          rowTokens.push(`"${valStr.replace(/"/g, '""')}"`);
        } else {
          rowTokens.push(valStr);
        }
      }
      lines.push(rowTokens.join(delimiter));
    }

    return lines.join("\r\n");
  }

  /**
   * Parses an RFC 4180 CSV or TSV string and populates cell data into target Sheet.
   */
  public static deserialize(csvText: string, targetSheet: Sheet, delimiter = ","): void {
    let r = 0;
    let c = 0;
    let currentField = "";
    let inQuotes = false;
    const len = csvText.length;

    for (let i = 0; i < len; i++) {
      const ch = csvText[i]!;

      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < len && csvText[i + 1] === '"') {
            currentField += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = false;
          }
        } else {
          currentField += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === delimiter) {
          if (currentField !== "") {
            targetSheet.setCellInput(r, c, currentField);
          }
          currentField = "";
          c++;
        } else if (ch === "\r") {
          // ignore CR if followed by LF
          if (i + 1 < len && csvText[i + 1] === "\n") {
            i++;
          }
          if (currentField !== "") {
            targetSheet.setCellInput(r, c, currentField);
          }
          currentField = "";
          r++;
          c = 0;
        } else if (ch === "\n") {
          if (currentField !== "") {
            targetSheet.setCellInput(r, c, currentField);
          }
          currentField = "";
          r++;
          c = 0;
        } else {
          currentField += ch;
        }
      }
    }

    // Flush final field
    if (currentField !== "") {
      targetSheet.setCellInput(r, c, currentField);
    }
  }
}
