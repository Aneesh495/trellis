import { describe, it, assert, assertEqual, assertCloseTo } from "./framework.js";
import { TrellisEngine } from "@trellis/engine";
import { TrellisError } from "@trellis/core";

describe("TrellisEngine: Core Reactive Recalculation", () => {
  it("should calculate literal values and simple formulas", () => {
    const engine = new TrellisEngine();
    engine.setCell("Sheet1", "A1", "50");
    engine.setCell("Sheet1", "B1", "25");
    engine.setCell("Sheet1", "C1", "=A1 + B1");

    assertEqual(engine.getCellValue("Sheet1", "A1"), 50);
    assertEqual(engine.getCellValue("Sheet1", "B1"), 25);
    assertEqual(engine.getCellValue("Sheet1", "C1"), 75);
  });

  it("should incrementally propagate updates through dependency chains", () => {
    const engine = new TrellisEngine();
    engine.setCell("Sheet1", "A1", "10");
    engine.setCell("Sheet1", "B1", "=A1 * 2");
    engine.setCell("Sheet1", "C1", "=B1 + 5");
    engine.setCell("Sheet1", "D1", "=C1 * 3");

    assertEqual(engine.getCellValue("Sheet1", "D1"), 75); // (10*2 + 5) * 3 = 75

    // Mutate root A1
    engine.setCell("Sheet1", "A1", "20");
    assertEqual(engine.getCellValue("Sheet1", "B1"), 40);
    assertEqual(engine.getCellValue("Sheet1", "C1"), 45);
    assertEqual(engine.getCellValue("Sheet1", "D1"), 135); // (20*2 + 5) * 3 = 135
  });

  it("should evaluate standard library range aggregators", () => {
    const engine = new TrellisEngine();
    engine.setCell("Sheet1", "A1", "10");
    engine.setCell("Sheet1", "A2", "20");
    engine.setCell("Sheet1", "A3", "30");
    engine.setCell("Sheet1", "A4", "40");
    engine.setCell("Sheet1", "B1", "=SUM(A1:A4)");
    engine.setCell("Sheet1", "B2", "=AVERAGE(A1:A4)");

    assertEqual(engine.getCellValue("Sheet1", "B1"), 100);
    assertEqual(engine.getCellValue("Sheet1", "B2"), 25);
  });
});

describe("TrellisEngine: Dynamic Array Spills and Ghost Cells", () => {
  it("should allocate 2D dynamic arrays and resolve ghost cells", () => {
    const engine = new TrellisEngine();
    // SEQUENCE(rows, cols, start, step)
    engine.setCell("Sheet1", "A1", "=SEQUENCE(2, 2, 10, 5)");

    // Root cell A1 holds matrix
    // A1 = 10, B1 = 15
    // A2 = 20, B2 = 25
    assertEqual(engine.getCellValue("Sheet1", "B1"), 15);
    assertEqual(engine.getCellValue("Sheet1", "A2"), 20);
    assertEqual(engine.getCellValue("Sheet1", "B2"), 25);

    // Dependent formula referencing a ghost cell
    engine.setCell("Sheet1", "C1", "=B2 * 2");
    assertEqual(engine.getCellValue("Sheet1", "C1"), 50);
  });

  it("should detect spill collisions and recover when obstruction is cleared", () => {
    const engine = new TrellisEngine();
    // Put obstruction at B2
    engine.setCell("Sheet1", "B2", "Blocked");

    // Attempt to spill 2x2 matrix at A1:A2, B1:B2
    engine.setCell("Sheet1", "A1", "=SEQUENCE(2, 2, 1, 1)");

    const val = engine.getCellValue("Sheet1", "A1");
    assert(val instanceof TrellisError, "A1 should hold a TrellisError due to collision");
    assertEqual((val as TrellisError).code, "#SPILL!");

    // Clear obstruction at B2
    engine.clearCell("Sheet1", "B2");

    // A1 should now spill cleanly
    assertEqual(engine.getCellValue("Sheet1", "B2"), 4);
  });
});

describe("TrellisEngine: Transactions and Batch Updates", () => {
  it("should execute batched mutations in a single recalculation pass", () => {
    const engine = new TrellisEngine();

    const { stats } = engine.batch((b) => {
      b.setCell("Sheet1", { row: 0, col: 0 }, "100");
      b.setCell("Sheet1", { row: 1, col: 0 }, "200");
      b.setCell("Sheet1", { row: 2, col: 0 }, "=A1 + A2");
    });

    assertEqual(engine.getCellValue("Sheet1", "A3"), 300);
    assertEqual(stats.evaluatedCount, 1);
  });
});

describe("TrellisEngine: Cycles and Multi-Sheet Names", () => {
  it("should detect circular dependencies and flag errors", () => {
    const engine = new TrellisEngine();
    let cycleDetected = false;

    engine.events.on("graph:cycle", () => {
      cycleDetected = true;
    });

    engine.setCell("Sheet1", "A1", "=B1 + 1");
    engine.setCell("Sheet1", "B1", "=A1 + 1");

    assertEqual(cycleDetected, true);
    const a1Val = engine.getCellValue("Sheet1", "A1");
    assert(a1Val instanceof TrellisError, "Cell in cycle should be an error");
  });

  it("should support cross-sheet references and named ranges", () => {
    const engine = new TrellisEngine();
    engine.setCell("Sheet1", "A1", "42");
    engine.setCell("Sheet2", "A1", "=Sheet1!A1 * 2");

    assertEqual(engine.getCellValue("Sheet2", "A1"), 84);

    // Named ranges
    engine.setNamedRange("TaxRate", "Sheet1!B1:B1");
    engine.setCell("Sheet1", "B1", "0.20");
    engine.setCell("Sheet1", "C1", "=A1 * TaxRate");

    assertCloseTo(engine.getCellValue("Sheet1", "C1") as number, 8.4, 1e-6);
  });
});
