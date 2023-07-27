import { describe, it, assert, assertEqual, assertDeepEqual } from "./framework.js";
import { TrellisEngine } from "@trellis/engine";
import { FunctionRegistry } from "@trellis/functions";
import { SimpleEvaluationContext } from "@trellis/runtime";
import { parseCellRef, TrellisError, TMatrix } from "@trellis/core";
import { ClipboardManager } from "@trellis/client";
import { RelationalTable, groupBy } from "@trellis/relational";

describe("Regression: Zero-Defect Bug Ledger and Invariant Prevention", () => {
  const reg = FunctionRegistry.getInstance();
  const ctx = new SimpleEvaluationContext();

  it("BUG-001: prevents variadic functions from rejecting valid arguments due to negative maxArgs", () => {
    // When maxArgs is -1, functions like SUM, AVERAGE, and PRODUCT must accept any count >= minArgs
    const sum1 = reg.call("SUM", [42], ctx);
    assertEqual(sum1, 42);

    const sum5 = reg.call("SUM", [10, 20, 30, 40, 50], ctx);
    assertEqual(sum5, 150);

    const prod3 = reg.call("PRODUCT", [2, 3, 4], ctx);
    assertEqual(prod3, 24);
  });

  it("BUG-002: preserves downstream graph dependents when a formula cell is replaced with a literal", () => {
    const engine = new TrellisEngine();

    // A1 starts as a formula, B1 depends on A1
    engine.setCell("Sheet1", parseCellRef("A1"), "=50");
    engine.setCell("Sheet1", parseCellRef("B1"), "=A1 * 2");
    assertEqual(engine.getCellValue("Sheet1", parseCellRef("B1")), 100);

    // Replace A1 with raw numeric literal 25
    engine.setCell("Sheet1", parseCellRef("A1"), "25");

    // B1 must still be reactive and recalculate to 50
    assertEqual(engine.getCellValue("Sheet1", parseCellRef("B1")), 50);
  });

  it("BUG-003: automatically recalculates blocked dynamic array spills when obstruction is cleared", () => {
    const engine = new TrellisEngine();

    // Put an obstruction in B2
    engine.setCell("Sheet1", parseCellRef("B2"), "BLOCKER");

    // A1 attempts to spill a 2x2 matrix into A1:B2, but B2 is occupied
    engine.setCell("Sheet1", parseCellRef("A1"), "={10, 20; 30, 40}");

    // A1 must report #SPILL!
    const a1Spill = engine.getCellValue("Sheet1", parseCellRef("A1"));
    assert(a1Spill instanceof TrellisError, "Expected A1 to error with #SPILL!");
    assertEqual((a1Spill as TrellisError).code, "#SPILL!");

    // Clear the blocking cell B2
    engine.clearCell("Sheet1", parseCellRef("B2"));

    // A1 must automatically recover and spill cleanly across A1:B2
    const a1Val = engine.getCellValue("Sheet1", parseCellRef("A1"));
    assert(a1Val instanceof TMatrix, "Expected A1 to hold spilled TMatrix");
    assertEqual((a1Val as TMatrix).get(0, 0), 10);
    const b2Val = engine.getCellValue("Sheet1", parseCellRef("B2"));
    assertEqual(b2Val, 40);
  });

  it("BUG-004: retains #REF! error state on cyclic cells without partial scalar overwrite", () => {
    const engine = new TrellisEngine();
    engine.workbook.calculationOptions.iterative = false;

    // Direct cycle between A1 and B1
    engine.setCell("Sheet1", parseCellRef("A1"), "=B1 + 1");
    engine.setCell("Sheet1", parseCellRef("B1"), "=A1 + 1");

    const a1Val = engine.getCellValue("Sheet1", parseCellRef("A1"));
    const b1Val = engine.getCellValue("Sheet1", parseCellRef("B1"));

    assert(a1Val instanceof TrellisError, "Expected A1 to retain #REF!");
    assert(b1Val instanceof TrellisError, "Expected B1 to retain #REF!");
    assertEqual((a1Val as TrellisError).code, "#REF!");
    assertEqual((b1Val as TrellisError).code, "#REF!");
  });

  it("BUG-005: deduplicates column modifications when multiple aggregations target the same field", () => {
    const matrix = new TMatrix([
      ["Category", "Revenue"],
      ["Tech", 100],
      ["Tech", 200],
      ["Health", 300]
    ]);
    const table = RelationalTable.fromMatrix(matrix);

    // Group by Category with both SUM and COUNT targeting Revenue
    const grouped = groupBy(
      table,
      ["Category"],
      [
        { column: "Revenue", as: "TotalRevenue", type: "SUM" },
        { column: "Revenue", as: "OrderCount", type: "COUNT" }
      ]
    );

    const outMatrix = grouped.toMatrix(true);
    // Row 0: Category, TotalRevenue, OrderCount
    // Row 1: Tech, 300, 2
    // Row 2: Health, 300, 1
    assertDeepEqual(outMatrix.toArray(), [
      ["Category", "TotalRevenue", "OrderCount"],
      ["Tech", 300, 2],
      ["Health", 300, 1]
    ]);
  });

  it("BUG-006: shifts relative cell references while pinning absolute rows and columns", () => {
    // Formula with mixed pinning: =A1 + $B1 + C$2 + $D$4
    const original = "=A1 + $B1 + C$2 + $D$4";
    // Shift by rowOffset = +3, colOffset = +2
    // A1 -> C4
    // $B1 -> $B4 (col pinned, row relative)
    // C$2 -> E$2 (col relative, row pinned)
    // $D$4 -> $D$4 (both pinned)
    const cb = new ClipboardManager();
    const shifted = cb.shiftFormulaReferences(original, 3, 2);
    assertEqual(shifted, "=C4 + $B4 + E$2 + $D$4");
  });
});
