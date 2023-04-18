import { describe, it, assert, assertEqual, assertThrows } from "./framework.js";
import {
  Workbook,
  Sheet,
  BinaryCodec,
  JsonCodec,
  CsvCodec,
  StyleRegistry
} from "../packages/storage/src/index.js";
import { parseRangeRef } from "@trellis/core";

describe("Storage: Workbook and Sheet Models", () => {
  it("manages multi-sheet hierarchies and named ranges", () => {
    const wb = new Workbook("Summary");
    const q1 = wb.addSheet("Q1");
    assertEqual(wb.sheets.length, 2);

    wb.setNamedRange("TAX_RATE", parseRangeRef("Summary!$B$1"));
    const taxRange = wb.getNamedRange("TAX_RATE");
    assert(taxRange !== undefined);
    assertEqual(taxRange!.sheet, "Summary");

    wb.renameSheet("Q1", "Q1_Actuals");
    assertEqual(q1.name, "Q1_Actuals");

    wb.removeSheet("Q1_Actuals");
    assertEqual(wb.sheets.length, 1);
  });

  it("formats numbers with StyleRegistry", () => {
    const styles = new StyleRegistry();
    assertEqual(styles.formatValue(1234.56, "$#,##0.00"), "$1,234.56");
    assertEqual(styles.formatValue(0.125, "0.0%"), "12.5%");
    assertEqual(styles.formatValue(5000000, "#,##0"), "5,000,000");
  });
});

describe("Storage: Binary .trellis Codec with CRC32", () => {
  it("serializes and deserializes workbooks with bit-exact roundtrip", () => {
    const wb = new Workbook("Finance");
    const sheet = wb.activeSheet;
    sheet.setCellInput(0, 0, "Revenue");
    sheet.setCellInput(0, 1, "100000");
    sheet.setCellInput(1, 0, "Expenses");
    sheet.setCellInput(1, 1, "40000");
    sheet.setCellInput(2, 0, "Net");
    sheet.setCellInput(2, 1, "=B1-B2");

    const binaryBytes = BinaryCodec.serialize(wb);
    assert(binaryBytes.length > 20);

    const roundtrip = BinaryCodec.deserialize(binaryBytes);
    assertEqual(roundtrip.sheets.length, 1);
    const rtSheet = roundtrip.sheets[0]!;
    assertEqual(rtSheet.name, "Finance");
    assertEqual(rtSheet.getCell(0, 0)?.value, "Revenue");
    assertEqual(rtSheet.getCell(0, 1)?.value, 100000);
    assertEqual(rtSheet.getCell(2, 1)?.formula, "=B1-B2");
  });

  it("detects data corruption via Castagnoli CRC32 checksum", () => {
    const wb = new Workbook("Test");
    wb.activeSheet.setCellInput(0, 0, "SafeData");

    const binaryBytes = BinaryCodec.serialize(wb);

    // Corrupt one byte in the payload
    const corrupted = new Uint8Array(binaryBytes);
    corrupted[corrupted.length - 5] ^= 0xff;

    assertThrows(() => {
      BinaryCodec.deserialize(corrupted);
    }, "CRC32 integrity verification failed");
  });
});

describe("Storage: JSON and CSV Codecs", () => {
  it("serializes and deserializes JSON workbooks", () => {
    const wb = new Workbook("Dashboard");
    wb.activeSheet.setCellInput(0, 0, "KPI");
    wb.activeSheet.setCellInput(0, 1, "99.9");

    const jsonStr = JsonCodec.serialize(wb);
    const roundtrip = JsonCodec.deserialize(jsonStr);

    assertEqual(roundtrip.sheets[0]!.name, "Dashboard");
    assertEqual(roundtrip.sheets[0]!.getCell(0, 0)?.value, "KPI");
  });

  it("serializes and deserializes RFC 4180 CSV with quotes and commas", () => {
    const sheet = new Sheet("CSV_Test");
    sheet.setCellInput(0, 0, "Item, Special");
    sheet.setCellInput(0, 1, 'Contains "Quotes"');
    sheet.setCellInput(1, 0, "Simple");
    sheet.setCellInput(1, 1, "42");

    const csvText = CsvCodec.serialize(sheet);
    assert(csvText.includes('"Item, Special"'));
    assert(csvText.includes('"Contains ""Quotes"""'));

    const roundtripSheet = new Sheet("Restored");
    CsvCodec.deserialize(csvText, roundtripSheet);

    assertEqual(roundtripSheet.getCell(0, 0)?.raw, "Item, Special");
    assertEqual(roundtripSheet.getCell(0, 1)?.raw, 'Contains "Quotes"');
    assertEqual(roundtripSheet.getCell(1, 0)?.raw, "Simple");
    assertEqual(roundtripSheet.getCell(1, 1)?.value, 42);
  });
});
