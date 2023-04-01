import { describe, it, assertEqual, assertCloseTo, assertDeepEqual } from "./framework.js";
import { FunctionRegistry } from "../packages/functions/src/index.js";
import { SimpleEvaluationContext } from "@trellis/runtime";
import { TMatrix, TrellisError } from "@trellis/core";

const reg = FunctionRegistry.getInstance();
const ctx = new SimpleEvaluationContext();

describe("Functions: Math and Trigonometry", () => {
  it("calculates SUM, PRODUCT, and ROUND", () => {
    const sumRes = reg.call("SUM", [10, 20, 30, TMatrix.rowVector([5, 15])], ctx);
    assertEqual(sumRes, 80);

    const prodRes = reg.call("PRODUCT", [2, 3, 4], ctx);
    assertEqual(prodRes, 24);

    const roundRes = reg.call("ROUND", [12.3456, 2], ctx);
    assertEqual(roundRes, 12.35);

    const sqrtRes = reg.call("SQRT", [144], ctx);
    assertEqual(sqrtRes, 12);
  });

  it("calculates conditional SUMIF and SUMPRODUCT", () => {
    const range = TMatrix.colVector([10, 20, 30, 40, 50]);
    const sumifRes = reg.call("SUMIF", [range, ">25"], ctx);
    assertEqual(sumifRes, 120);

    const arr1 = TMatrix.colVector([1, 2, 3]);
    const arr2 = TMatrix.colVector([10, 20, 30]);
    const sumprodRes = reg.call("SUMPRODUCT", [arr1, arr2], ctx);
    assertEqual(sumprodRes, 140); // 1*10 + 2*20 + 3*30 = 140
  });

  it("performs matrix multiplication with MMULT", () => {
    const a = new TMatrix([
      [1, 2],
      [3, 4]
    ]);
    const b = new TMatrix([
      [2, 0],
      [1, 2]
    ]);
    const res = reg.call("MMULT", [a, b], ctx) as TMatrix;
    assertDeepEqual(res.toArray(), [
      [4, 4],
      [10, 8]
    ]);
  });
});

describe("Functions: Statistics", () => {
  it("calculates AVERAGE, MEDIAN, and STDEV.S", () => {
    const nums = TMatrix.colVector([10, 20, 30, 40, 50]);
    assertEqual(reg.call("AVERAGE", [nums], ctx), 30);
    assertEqual(reg.call("MEDIAN", [nums], ctx), 30);

    const stdev = reg.call("STDEV.S", [nums], ctx) as number;
    assertCloseTo(stdev, 15.8113883, 1e-5);
  });

  it("calculates linear regression SLOPE, INTERCEPT, and FORECAST", () => {
    const y = TMatrix.colVector([2, 4, 6, 8, 10]);
    const x = TMatrix.colVector([1, 2, 3, 4, 5]);

    assertEqual(reg.call("SLOPE", [y, x], ctx), 2);
    assertEqual(reg.call("INTERCEPT", [y, x], ctx), 0);
    assertEqual(reg.call("FORECAST", [6, y, x], ctx), 12);
  });
});

describe("Functions: Financial Mathematics", () => {
  it("calculates loan payments using PMT, PV, and FV", () => {
    // $100,000 loan, 6% annual rate (0.5% monthly), 360 months
    const rate = 0.06 / 12;
    const nper = 360;
    const pv = 100000;

    const pmt = reg.call("PMT", [rate, nper, pv], ctx) as number;
    assertCloseTo(pmt, -599.55, 0.01);

    const pvCalc = reg.call("PV", [rate, nper, pmt], ctx) as number;
    assertCloseTo(pvCalc, pv, 0.01);
  });

  it("solves Internal Rate of Return (IRR) numerically", () => {
    // Initial investment -$10,000, then positive cash flows of $3,000, $4,200, $6,800
    const cashFlows = TMatrix.colVector([-10000, 3000, 4200, 6800]);
    const irr = reg.call("IRR", [cashFlows], ctx) as number;
    assertCloseTo(irr, 0.1634, 0.001); // ~16.34%
  });

  it("calculates Net Present Value with NPV", () => {
    const rate = 0.1;
    const cashFlows = [TMatrix.colVector([1000, 2000, 3000])];
    const npv = reg.call("NPV", [rate, ...cashFlows], ctx) as number;
    assertCloseTo(npv, 4815.93, 0.01);
  });
});

describe("Functions: Logical and Conditions", () => {
  it("evaluates IFS, SWITCH, and CHOOSE", () => {
    const ifsRes = reg.call("IFS", [false, 1, true, 2, true, 3], ctx);
    assertEqual(ifsRes, 2);

    const switchRes = reg.call("SWITCH", ["B", "A", 100, "B", 200, "C", 300, 999], ctx);
    assertEqual(switchRes, 200);

    const chooseRes = reg.call("CHOOSE", [2, "Gold", "Silver", "Bronze"], ctx);
    assertEqual(chooseRes, "Silver");

    const iferrRes = reg.call("IFERROR", [TrellisError.divZero(), "Fallback"], ctx);
    assertEqual(iferrRes, "Fallback");
  });
});

describe("Functions: Text Manipulation", () => {
  it("joins and slices text with TEXTJOIN, MID, and REGEXEXTRACT", () => {
    const joinRes = reg.call("TEXTJOIN", [", ", true, "Apple", "", "Banana", "Cherry"], ctx);
    assertEqual(joinRes, "Apple, Banana, Cherry");

    const midRes = reg.call("MID", ["TrellisEngine", 8, 6], ctx);
    assertEqual(midRes, "Engine");

    const regexRes = reg.call("REGEXEXTRACT", ["OrderID: #12845 Completed", "#([0-9]+)"], ctx);
    assertEqual(regexRes, "12845");

    const splitRes = reg.call("SPLIT", ["A;B;C", ";"], ctx) as TMatrix;
    assertDeepEqual(splitRes.toArray(), [["A", "B", "C"]]);
  });
});

describe("Functions: DateTime Operations", () => {
  it("calculates DATE, calendar components, and NETWORKDAYS", () => {
    const dateSerial = reg.call("DATE", [2026, 10, 26], ctx) as number;
    assertEqual(reg.call("YEAR", [dateSerial], ctx), 2026);
    assertEqual(reg.call("MONTH", [dateSerial], ctx), 10);
    assertEqual(reg.call("DAY", [dateSerial], ctx), 26);

    // Monday Oct 26 to Friday Oct 30 = 5 network days
    const monday = reg.call("DATE", [2026, 10, 26], ctx) as number;
    const friday = reg.call("DATE", [2026, 10, 30], ctx) as number;
    const networkdays = reg.call("NETWORKDAYS", [monday, friday], ctx);
    assertEqual(networkdays, 5);
  });
});

describe("Functions: Lookup and Reference", () => {
  it("performs exact and binary lookups with VLOOKUP and XLOOKUP", () => {
    const table = new TMatrix([
      ["SKU101", "Widget", 19.99],
      ["SKU102", "Gadget", 29.99],
      ["SKU103", "Doohickey", 9.99]
    ]);

    const vlookupRes = reg.call("VLOOKUP", ["SKU102", table, 2, false], ctx);
    assertEqual(vlookupRes, "Gadget");

    const keys = TMatrix.colVector(["A", "B", "C", "D"]);
    const vals = TMatrix.colVector([10, 20, 30, 40]);
    const xlookupRes = reg.call("XLOOKUP", ["C", keys, vals], ctx);
    assertEqual(xlookupRes, 30);
  });

  it("slices dimensions with TAKE and CHOOSECOLS", () => {
    const mat = new TMatrix([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9]
    ]);

    const takeRes = reg.call("TAKE", [mat, 2, 2], ctx) as TMatrix;
    assertDeepEqual(takeRes.toArray(), [
      [1, 2],
      [4, 5]
    ]);

    const chooseRes = reg.call("CHOOSECOLS", [mat, 3, 1], ctx) as TMatrix;
    assertDeepEqual(chooseRes.toArray(), [
      [3, 1],
      [6, 4],
      [9, 7]
    ]);
  });
});

describe("Functions: Dynamic Array Operators", () => {
  it("filters and sorts arrays with FILTER, SORT, and UNIQUE", () => {
    const data = new TMatrix([
      ["Alice", 85],
      ["Bob", 62],
      ["Charlie", 92],
      ["Dave", 74]
    ]);
    const cond = TMatrix.colVector([true, false, true, false]);
    const filterRes = reg.call("FILTER", [data, cond], ctx) as TMatrix;
    assertDeepEqual(filterRes.toArray(), [
      ["Alice", 85],
      ["Charlie", 92]
    ]);

    const seqRes = reg.call("SEQUENCE", [3, 2, 10, 5], ctx) as TMatrix;
    assertDeepEqual(seqRes.toArray(), [
      [10, 15],
      [20, 25],
      [30, 35]
    ]);

    const dupData = TMatrix.colVector(["A", "B", "A", "C", "B"]);
    const uniqRes = reg.call("UNIQUE", [dupData], ctx) as TMatrix;
    assertDeepEqual(uniqRes.toArray(), [["A"], ["B"], ["C"]]);
  });
});

describe("Functions: Type Reflection and Diagnostics", () => {
  it("checks types with ISBLANK, ISNUMBER, and TYPE", () => {
    assertEqual(reg.call("ISBLANK", [null], ctx), true);
    assertEqual(reg.call("ISBLANK", ["hello"], ctx), false);
    assertEqual(reg.call("ISNUMBER", [42], ctx), true);
    assertEqual(reg.call("ISNUMBER", ["42"], ctx), false);
    assertEqual(reg.call("TYPE", [100], ctx), 1);
    assertEqual(reg.call("TYPE", ["text"], ctx), 2);
    assertEqual(reg.call("TYPE", [true], ctx), 4);
    assertEqual(reg.call("TYPE", [TrellisError.naError()], ctx), 16);
    assertEqual(reg.call("TYPE", [new TMatrix([[1]])], ctx), 64);
  });
});
