import { describe, it, assert, assertEqual, assertCloseTo } from "./framework.js";
import { TrellisEngine } from "@trellis/engine";
import { parseCellRef, TrellisError } from "@trellis/core";

describe("Engine: Iterative Calculation and Cycle Resolution", () => {
  it("flags circular dependencies as #REF! when iterative calculation is disabled", () => {
    const engine = new TrellisEngine();
    engine.workbook.calculationOptions.iterative = false;

    engine.setCell("Sheet1", parseCellRef("A1"), "=B1 + 10");
    engine.setCell("Sheet1", parseCellRef("B1"), "=A1 + 5");

    const a1Val = engine.getCellValue("Sheet1", parseCellRef("A1"));
    const b1Val = engine.getCellValue("Sheet1", parseCellRef("B1"));

    assert(a1Val instanceof TrellisError, "Expected A1 to be TrellisError");
    assert(b1Val instanceof TrellisError, "Expected B1 to be TrellisError");
    assertEqual((a1Val as TrellisError).code, "#REF!");
    assertEqual((b1Val as TrellisError).code, "#REF!");
  });

  it("resolves circular references via iterative relaxation when enabled", () => {
    const engine = new TrellisEngine();
    engine.workbook.calculationOptions.iterative = true;
    engine.workbook.calculationOptions.maxIterations = 100;
    engine.workbook.calculationOptions.tolerance = 1e-5;

    // Mathematical equilibrium: x = 0.5 * x + 50 => 0.5 * x = 50 => x = 100
    engine.setCell("Sheet1", parseCellRef("A1"), "=B1 * 0.5 + 50");
    engine.setCell("Sheet1", parseCellRef("B1"), "=A1");

    const a1Val = engine.getCellValue("Sheet1", parseCellRef("A1"));
    const b1Val = engine.getCellValue("Sheet1", parseCellRef("B1"));

    assert(typeof a1Val === "number", "Expected A1 to converge to a number");
    assert(typeof b1Val === "number", "Expected B1 to converge to a number");
    assertCloseTo(a1Val as number, 100, 1e-4);
    assertCloseTo(b1Val as number, 100, 1e-4);
  });

  it("correctly calculates downstream dependents of converged cyclic loops", () => {
    const engine = new TrellisEngine();
    engine.workbook.calculationOptions.iterative = true;
    engine.workbook.calculationOptions.maxIterations = 100;
    engine.workbook.calculationOptions.tolerance = 1e-5;

    // Cyclic pair
    engine.setCell("Sheet1", parseCellRef("A1"), "=B1 * 0.5 + 50");
    engine.setCell("Sheet1", parseCellRef("B1"), "=A1");
    // Downstream cell
    engine.setCell("Sheet1", parseCellRef("C1"), "=A1 * 2 + 10");

    const c1Val = engine.getCellValue("Sheet1", parseCellRef("C1"));
    assert(typeof c1Val === "number", "Expected C1 to evaluate to a number");
    assertCloseTo(c1Val as number, 210, 1e-4);
  });

  it("converges complex financial circular debt interest schedule", () => {
    const engine = new TrellisEngine();
    engine.workbook.calculationOptions.iterative = true;
    engine.workbook.calculationOptions.maxIterations = 100;
    engine.workbook.calculationOptions.tolerance = 1e-4;

    // Operating cash flow = 1000
    engine.setCell("Sheet1", parseCellRef("A1"), "1000");
    // Interest expense = 5% of average debt (B3)
    engine.setCell("Sheet1", parseCellRef("A2"), "=B3 * 0.05");
    // Net cash flow = Operating CF - Interest
    engine.setCell("Sheet1", parseCellRef("A3"), "=A1 - A2");
    // Beginning debt = 5000
    engine.setCell("Sheet1", parseCellRef("B1"), "5000");
    // Principal repayment = 20% of net cash flow
    engine.setCell("Sheet1", parseCellRef("B2"), "=A3 * 0.20");
    // Ending debt = Beginning debt - Principal repayment
    engine.setCell("Sheet1", parseCellRef("B3"), "=B1 - B2");

    // Theoretical equilibrium:
    // B3 = 5000 - 0.2 * (1000 - 0.05 * B3)
    // B3 = 5000 - 200 + 0.01 * B3
    // 0.99 * B3 = 4800 => B3 = 4800 / 0.99 = 4848.4848...
    const b3Val = engine.getCellValue("Sheet1", parseCellRef("B3"));
    assert(typeof b3Val === "number", "Expected ending debt B3 to be numeric");
    assertCloseTo(b3Val as number, 4800 / 0.99, 1e-2);
  });
});
