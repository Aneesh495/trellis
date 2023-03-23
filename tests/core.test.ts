import { describe, it, assert, assertEqual, assertDeepEqual, assertThrows } from "./framework.js";
import {
  colToIndex,
  indexToCol,
  parseCellRef,
  formatCellRef,
  parseRangeRef,
  formatRangeRef,
  rangesIntersect,
  rangeContainsCell,
  rangeContains,
  rangeUnion,
  rangeCellCount,
  coerceToNumber,
  coerceToString,
  coerceToBoolean,
  coerceToDate,
  compareValues,
  valuesEqual,
  TMatrix,
  TypedEventEmitter,
  CellChangeEvent
} from "../packages/core/src/index.js";

describe("Core: Address and Coordinates", () => {
  it("converts column names to indices and back", () => {
    assertEqual(colToIndex("A"), 0);
    assertEqual(colToIndex("Z"), 25);
    assertEqual(colToIndex("AA"), 26);
    assertEqual(colToIndex("AZ"), 51);
    assertEqual(colToIndex("BA"), 52);
    assertEqual(colToIndex("ZZ"), 701);
    assertEqual(colToIndex("AAA"), 702);

    assertEqual(indexToCol(0), "A");
    assertEqual(indexToCol(25), "Z");
    assertEqual(indexToCol(26), "AA");
    assertEqual(indexToCol(51), "AZ");
    assertEqual(indexToCol(52), "BA");
    assertEqual(indexToCol(701), "ZZ");
    assertEqual(indexToCol(702), "AAA");
  });

  it("parses individual cell references", () => {
    const c1 = parseCellRef("B3");
    assertEqual(c1.col, 1);
    assertEqual(c1.row, 2);
    assertEqual(c1.colFixed, false);
    assertEqual(c1.rowFixed, false);
    assertEqual(c1.sheet, undefined);

    const c2 = parseCellRef("$C$5");
    assertEqual(c2.col, 2);
    assertEqual(c2.row, 4);
    assertEqual(c2.colFixed, true);
    assertEqual(c2.rowFixed, true);

    const c3 = parseCellRef("Sheet1!$D8");
    assertEqual(c3.col, 3);
    assertEqual(c3.row, 7);
    assertEqual(c3.colFixed, true);
    assertEqual(c3.rowFixed, false);
    assertEqual(c3.sheet, "Sheet1");

    const c4 = parseCellRef("'Financial Model'!K$12");
    assertEqual(c4.col, 10);
    assertEqual(c4.row, 11);
    assertEqual(c4.sheet, "Financial Model");
  });

  it("formats cell references accurately", () => {
    assertEqual(formatCellRef({ row: 0, col: 0 }), "A1");
    assertEqual(formatCellRef({ row: 4, col: 2, colFixed: true, rowFixed: true }), "$C$5");
    assertEqual(formatCellRef({ row: 7, col: 3, sheet: "Sheet1" }), "Sheet1!D8");
    assertEqual(formatCellRef({ row: 11, col: 10, sheet: "Financial Model", rowFixed: true }), "'Financial Model'!K$12");

    const r = parseRangeRef("A1:C5");
    assertEqual(formatRangeRef(r), "A1:C5");
  });

  it("parses and normalizes rectangular ranges", () => {
    const r1 = parseRangeRef("A1:C5");
    assertEqual(r1.startRow, 0);
    assertEqual(r1.startCol, 0);
    assertEqual(r1.endRow, 4);
    assertEqual(r1.endCol, 2);

    // Inverted range order should be normalized
    const r2 = parseRangeRef("C5:A1");
    assertEqual(r2.startRow, 0);
    assertEqual(r2.startCol, 0);
    assertEqual(r2.endRow, 4);
    assertEqual(r2.endCol, 2);

    // Sheet qualification
    const r3 = parseRangeRef("'Data'!$B$2:$E$10");
    assertEqual(r3.sheet, "Data");
    assertEqual(r3.startCol, 1);
    assertEqual(r3.startRow, 1);
    assertEqual(r3.endCol, 4);
    assertEqual(r3.endRow, 9);
  });

  it("supports whole-row and whole-column ranges", () => {
    const colRange = parseRangeRef("B:D");
    assertEqual(colRange.startCol, 1);
    assertEqual(colRange.endCol, 3);
    assertEqual(colRange.startRow, 0);

    const rowRange = parseRangeRef("5:10");
    assertEqual(rowRange.startRow, 4);
    assertEqual(rowRange.endRow, 9);
    assertEqual(rowRange.startCol, 0);
  });

  it("handles geometric range intersection and containment", () => {
    const r1 = parseRangeRef("B2:D4");
    const r2 = parseRangeRef("C3:E6");
    const r3 = parseRangeRef("F6:G8");

    assert(rangesIntersect(r1, r2), "B2:D4 and C3:E6 should intersect at C3:D4");
    assert(!rangesIntersect(r1, r3), "B2:D4 and F6:G8 should not intersect");

    assert(rangeContainsCell(r1, { row: 1, col: 1 }), "B2 should be inside B2:D4");
    assert(rangeContainsCell(r1, { row: 3, col: 3 }), "D4 should be inside B2:D4");
    assert(!rangeContainsCell(r1, { row: 4, col: 3 }), "D5 should not be inside B2:D4");

    const parent = parseRangeRef("A1:F10");
    const child = parseRangeRef("B2:D5");
    assert(rangeContains(parent, child));
    assert(!rangeContains(child, parent));

    const union = rangeUnion(r1, r2);
    assertEqual(union.startRow, 1);
    assertEqual(union.startCol, 1);
    assertEqual(union.endRow, 5);
    assertEqual(union.endCol, 4);

    assertEqual(rangeCellCount(r1), 9);
  });
});

describe("Core: Coercion Matrix", () => {
  it("coerces values to numbers", () => {
    assertEqual(coerceToNumber(null), 0);
    assertEqual((coerceToNumber as (v: unknown) => number)(undefined), 0);
    assertEqual(coerceToNumber(true), 1);
    assertEqual(coerceToNumber(false), 0);
    assertEqual(coerceToNumber(42.5), 42.5);
    assertEqual(coerceToNumber("123.45"), 123.45);
    assertEqual(coerceToNumber(" 50% "), 0.5);
    assertEqual(coerceToNumber("$1,250.75"), 1250.75);

    assertThrows(() => coerceToNumber("not_a_number"), "#VALUE!");
  });

  it("coerces values to strings", () => {
    assertEqual(coerceToString(null), "");
    assertEqual(coerceToString(true), "TRUE");
    assertEqual(coerceToString(false), "FALSE");
    assertEqual(coerceToString(100), "100");
    assertEqual(coerceToString("hello"), "hello");
  });

  it("coerces values to booleans", () => {
    assertEqual(coerceToBoolean(null), false);
    assertEqual(coerceToBoolean(1), true);
    assertEqual(coerceToBoolean(0), false);
    assertEqual(coerceToBoolean("TRUE"), true);
    assertEqual(coerceToBoolean("FALSE"), false);
  });

  it("converts dates and serial numbers bidirectionally", () => {
    const d = new Date(Date.UTC(2026, 9, 26, 0, 0, 0));
    const serial = coerceToNumber(d);
    const roundtrip = coerceToDate(serial);
    assertEqual(roundtrip.getUTCFullYear(), 2026);
    assertEqual(roundtrip.getUTCMonth(), 9);
    assertEqual(roundtrip.getUTCDate(), 26);
  });

  it("compares mixed-type values according to spreadsheet ordering", () => {
    // Null < Numbers < Strings < Booleans
    assert(compareValues(null, 0) < 0);
    assert(compareValues(0, 1) < 0);
    assert(compareValues(999, "abc") < 0);
    assert(compareValues("xyz", false) < 0);
    assert(compareValues(false, true) < 0);
    assert(valuesEqual("hello", "hello"));
  });
});

describe("Core: TMatrix Primitives", () => {
  it("creates, indexes, transposes, and slices matrices", () => {
    const mat = new TMatrix([
      [1, 2, 3],
      [4, 5, 6]
    ]);
    assertEqual(mat.rowCount, 2);
    assertEqual(mat.colCount, 3);
    assertEqual(mat.get(0, 0), 1);
    assertEqual(mat.get(1, 2), 6);
    assertEqual(mat.get(99, 99), null);

    const transposed = mat.transpose();
    assertEqual(transposed.rowCount, 3);
    assertEqual(transposed.colCount, 2);
    assertEqual(transposed.get(0, 1), 4);
    assertEqual(transposed.get(2, 1), 6);

    const sliced = mat.slice(0, 1, 1, 2);
    assertEqual(sliced.rowCount, 2);
    assertEqual(sliced.colCount, 2);
    assertDeepEqual(sliced.toArray(), [
      [2, 3],
      [5, 6]
    ]);

    const mapped = mat.map((v) => (typeof v === "number" ? v * 10 : v));
    assertDeepEqual(mapped.toArray(), [
      [10, 20, 30],
      [40, 50, 60]
    ]);
  });
});

describe("Core: TypedEventEmitter", () => {
  it("emits events and honors unsubscription handles", () => {
    const bus = new TypedEventEmitter();
    let changeCount = 0;

    const unsubscribe = bus.on("cell:change", (e: CellChangeEvent) => {
      changeCount++;
      assertEqual(e.coord.row, 0);
      assertEqual(e.coord.col, 0);
    });

    bus.emit("cell:change", { coord: { row: 0, col: 0 }, newValue: 10 });
    assertEqual(changeCount, 1);

    unsubscribe();
    bus.emit("cell:change", { coord: { row: 0, col: 0 }, newValue: 20 });
    assertEqual(changeCount, 1);
  });
});
