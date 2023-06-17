import { describe, it, assert, assertEqual, assertDeepEqual } from "./framework.js";
import { TrellisEngine } from "@trellis/engine";
import { TMatrix, TrellisError } from "@trellis/core";

describe("Functions: Dynamic Array Combinators", () => {
  const engine = new TrellisEngine();

  it("evaluates MAP across a single matrix", () => {
    const res = engine.evaluateFormula("Sheet1", "=MAP({1, 2; 3, 4}, LAMBDA(x, x * 10))");
    assert(res instanceof TMatrix, "Expected MAP to return a TMatrix");
    const m = res as TMatrix;
    assertEqual(m.rowCount, 2);
    assertEqual(m.colCount, 2);
    assertEqual(m.get(0, 0), 10);
    assertEqual(m.get(0, 1), 20);
    assertEqual(m.get(1, 0), 30);
    assertEqual(m.get(1, 1), 40);
  });

  it("evaluates MAP across multiple aligned arrays", () => {
    const res = engine.evaluateFormula("Sheet1", "=MAP({1, 2}, {10, 20}, LAMBDA(a, b, a + b))");
    assert(res instanceof TMatrix, "Expected MAP to return a TMatrix");
    const m = res as TMatrix;
    assertEqual(m.rowCount, 1);
    assertEqual(m.colCount, 2);
    assertEqual(m.get(0, 0), 11);
    assertEqual(m.get(0, 1), 22);
  });

  it("returns error on MAP dimension mismatch", () => {
    const res = engine.evaluateFormula("Sheet1", "=MAP({1, 2}, {10; 20}, LAMBDA(a, b, a + b))");
    assert(res instanceof TrellisError, "Expected dimension mismatch to return TrellisError");
  });

  it("evaluates REDUCE for numerical accumulation", () => {
    const res = engine.evaluateFormula("Sheet1", "=REDUCE(0, {1, 2, 3, 4, 5}, LAMBDA(acc, val, acc + val))");
    assertEqual(res, 15);
  });

  it("evaluates REDUCE for string concatenation", () => {
    const res = engine.evaluateFormula("Sheet1", "=REDUCE(\"\", {\"A\", \"B\", \"C\"}, LAMBDA(acc, val, acc & val))");
    assertEqual(res, "ABC");
  });

  it("evaluates SCAN returning cumulative running states", () => {
    const res = engine.evaluateFormula("Sheet1", "=SCAN(0, {1, 2, 3, 4}, LAMBDA(acc, val, acc + val))");
    assert(res instanceof TMatrix, "Expected SCAN to return a TMatrix");
    const m = res as TMatrix;
    assertEqual(m.rowCount, 1);
    assertEqual(m.colCount, 4);
    assertDeepEqual(m.toArray(), [[1, 3, 6, 10]]);
  });

  it("evaluates BYROW applying reduction along each row", () => {
    const res = engine.evaluateFormula("Sheet1", "=BYROW({1, 2; 3, 4; 5, 6}, LAMBDA(r, SUM(r)))");
    assert(res instanceof TMatrix, "Expected BYROW to return a TMatrix");
    const m = res as TMatrix;
    assertEqual(m.rowCount, 3);
    assertEqual(m.colCount, 1);
    assertDeepEqual(m.toArray(), [[3], [7], [11]]);
  });

  it("evaluates BYCOL applying reduction along each column", () => {
    const res = engine.evaluateFormula("Sheet1", "=BYCOL({10, 20; 30, 40}, LAMBDA(c, AVERAGE(c)))");
    assert(res instanceof TMatrix, "Expected BYCOL to return a TMatrix");
    const m = res as TMatrix;
    assertEqual(m.rowCount, 1);
    assertEqual(m.colCount, 2);
    assertDeepEqual(m.toArray(), [[20, 30]]);
  });

  it("evaluates MAKEARRAY generating custom 2D coordinate patterns", () => {
    const res = engine.evaluateFormula("Sheet1", "=MAKEARRAY(3, 3, LAMBDA(r, c, r * c))");
    assert(res instanceof TMatrix, "Expected MAKEARRAY to return a TMatrix");
    const m = res as TMatrix;
    assertEqual(m.rowCount, 3);
    assertEqual(m.colCount, 3);
    assertDeepEqual(m.toArray(), [
      [1, 2, 3],
      [2, 4, 6],
      [3, 6, 9]
    ]);
  });

  it("rejects non-positive dimensions in MAKEARRAY", () => {
    const res = engine.evaluateFormula("Sheet1", "=MAKEARRAY(-1, 3, LAMBDA(r, c, r + c))");
    assert(res instanceof TrellisError, "Expected non-positive dimensions to return error");
  });
});
