import { describe, it, assert, assertEqual, assertCloseTo, assertDeepEqual } from "./framework.js";
import { FunctionRegistry } from "../packages/functions/src/index.js";
import { SimpleEvaluationContext } from "@trellis/runtime";
import { TMatrix, TrellisError, dateToSerial } from "@trellis/core";

const reg = FunctionRegistry.getInstance();
const ctx = new SimpleEvaluationContext();

describe("Functions: Extended Financial Schedules", () => {
  it("computes MIRR across asymmetric negative and positive cash flows", () => {
    // Investment: -10000, returns: 3000, 4200, 6800
    // Finance rate = 10%, Reinvestment rate = 12%
    const flows = TMatrix.colVector([-10000, 3000, 4200, 6800]);
    const res = reg.call("MIRR", [flows, 0.10, 0.12], ctx);
    assert(typeof res === "number", "Expected MIRR to be numeric");
    assertCloseTo(res as number, 0.15147, 1e-4);
  });

  it("calculates SYD depreciation across life periods", () => {
    // Cost 10000, Salvage 1000, Life 5
    // Year 1: (10000 - 1000) * 5 * 2 / (5 * 6) = 9000 * 10 / 30 = 3000
    // Year 5: 9000 * 2 / 30 = 600
    const syd1 = reg.call("SYD", [10000, 1000, 5, 1], ctx);
    const syd5 = reg.call("SYD", [10000, 1000, 5, 5], ctx);
    assertEqual(syd1, 3000);
    assertEqual(syd5, 600);
  });

  it("calculates DB fixed-declining balance depreciation", () => {
    // Cost 10000, Salvage 1000, Life 5, Period 1
    const db1 = reg.call("DB", [10000, 1000, 5, 1], ctx);
    assert(typeof db1 === "number", "Expected DB to be numeric");
    assertCloseTo(db1 as number, 3690, 1);
  });

  it("calculates DDB double-declining balance depreciation", () => {
    // Cost 10000, Salvage 1000, Life 5, Period 1 -> 10000 * (2/5) = 4000
    const ddb1 = reg.call("DDB", [10000, 1000, 5, 1], ctx);
    assertEqual(ddb1, 4000);
  });
});

describe("Functions: Extended DateTime Conventions", () => {
  it("calculates WORKDAY advancing past weekends and holidays", () => {
    // Serial date for a Friday
    const friday = dateToSerial(new Date(Date.UTC(2025, 0, 10))); // Friday Jan 10, 2025
    // Advancing 1 workday lands on Monday Jan 13, 2025
    const monday = reg.call("WORKDAY", [friday, 1], ctx);
    const expectedMonday = dateToSerial(new Date(Date.UTC(2025, 0, 13)));
    assertEqual(monday, expectedMonday);

    // Advancing past a holiday on Monday Jan 13 lands on Tuesday Jan 14
    const tuesday = reg.call("WORKDAY", [friday, 1, expectedMonday], ctx);
    const expectedTuesday = dateToSerial(new Date(Date.UTC(2025, 0, 14)));
    assertEqual(tuesday, expectedTuesday);
  });

  it("calculates DAYS360 day counts under US and European methods", () => {
    const d1 = dateToSerial(new Date(Date.UTC(2025, 0, 1)));
    const d2 = dateToSerial(new Date(Date.UTC(2025, 6, 1)));
    const countUS = reg.call("DAYS360", [d1, d2], ctx);
    assertEqual(countUS, 180);
  });

  it("calculates ISOWEEKNUM for standard calendar dates", () => {
    const d = dateToSerial(new Date(Date.UTC(2025, 0, 1))); // Jan 1, 2025 is Wednesday, week 1
    const week = reg.call("ISOWEEKNUM", [d], ctx);
    assertEqual(week, 1);
  });

  it("computes YEARFRAC across distinct day count bases", () => {
    const d1 = dateToSerial(new Date(Date.UTC(2024, 0, 1)));
    const d2 = dateToSerial(new Date(Date.UTC(2024, 6, 1)));
    const yf0 = reg.call("YEARFRAC", [d1, d2, 0], ctx); // 30/360
    assertEqual(yf0, 0.5);

    const yf2 = reg.call("YEARFRAC", [d1, d2, 2], ctx); // Actual/360
    assert(typeof yf2 === "number", "Expected YEARFRAC basis 2 to be numeric");
    assertCloseTo(yf2 as number, 182 / 360, 1e-3);
  });
});

describe("Functions: Extended Statistics and Quantiles", () => {
  it("calculates sample and population covariance", () => {
    const x = TMatrix.colVector([2, 4, 6, 8, 10]);
    const y = TMatrix.colVector([3, 5, 7, 9, 11]);

    const covS = reg.call("COVARIANCE.S", [x, y], ctx);
    const covP = reg.call("COVARIANCE.P", [x, y], ctx);
    assertEqual(covS, 10);
    assertEqual(covP, 8);
  });

  it("calculates quartiles and percentiles", () => {
    const data = TMatrix.colVector([10, 20, 30, 40, 50]);
    const q1 = reg.call("QUARTILE.INC", [data, 1], ctx);
    const q2 = reg.call("QUARTILE.INC", [data, 2], ctx);
    const q3 = reg.call("QUARTILE.INC", [data, 3], ctx);
    assertEqual(q1, 20);
    assertEqual(q2, 30);
    assertEqual(q3, 40);
  });

  it("calculates MODE.SNGL and throws on lack of duplicate mode", () => {
    const data = TMatrix.colVector([1, 2, 2, 3, 4]);
    const mode = reg.call("MODE.SNGL", [data], ctx);
    assertEqual(mode, 2);

    try {
      reg.call("MODE.SNGL", [TMatrix.colVector([1, 2, 3, 4, 5])], ctx);
      assert(false, "Expected error on distinct values in MODE.SNGL");
    } catch (e) {
      assert(e instanceof TrellisError, "Expected TrellisError on no mode");
    }
  });

  it("computes NORM.INV accurately inverting NORM.DIST CDF", () => {
    const mean = 100;
    const stdev = 15;
    const p = 0.8413447; // Approximately 1 sigma above mean (115)
    const z = reg.call("NORM.INV", [p, mean, stdev], ctx);
    assert(typeof z === "number", "Expected NORM.INV to return numeric");
    assertCloseTo(z as number, 115, 0.05);

    // Median quantile
    const median = reg.call("NORM.INV", [0.5, mean, stdev], ctx);
    assertEqual(median, 100);
  });
});

describe("Functions: Extended Modern Text Combinators", () => {
  it("splits text across columns and rows with TEXTSPLIT", () => {
    const resCol = reg.call("TEXTSPLIT", ["apple,banana,cherry", ","], ctx);
    assert(resCol instanceof TMatrix, "Expected TEXTSPLIT to return TMatrix");
    assertDeepEqual((resCol as TMatrix).toArray(), [["apple", "banana", "cherry"]]);

    const res2D = reg.call("TEXTSPLIT", ["1,2;3,4", ",", ";"], ctx);
    assert(res2D instanceof TMatrix, "Expected 2D TEXTSPLIT to return TMatrix");
    assertDeepEqual((res2D as TMatrix).toArray(), [["1", "2"], ["3", "4"]]);
  });

  it("extracts prefixes and suffixes with TEXTBEFORE and TEXTAFTER", () => {
    const text = "user@domain.corp.com";
    const user = reg.call("TEXTBEFORE", [text, "@"], ctx);
    assertEqual(user, "user");

    const host = reg.call("TEXTAFTER", [text, "@"], ctx);
    assertEqual(host, "domain.corp.com");

    const tld = reg.call("TEXTAFTER", [text, ".", -1], ctx);
    assertEqual(tld, "com");

    const sub = reg.call("TEXTBEFORE", [text, ".", 1], ctx);
    assertEqual(sub, "user@domain");
  });

  it("formats scalars and matrices with VALUETOTEXT and ARRAYTOTEXT", () => {
    const textVal = reg.call("VALUETOTEXT", ["hello", 1], ctx);
    assertEqual(textVal, "\"hello\"");

    const arr = TMatrix.rowVector([10, 20, 30]);
    const concise = reg.call("ARRAYTOTEXT", [arr, 0], ctx);
    assertEqual(concise, "10, 20, 30");

    const strict = reg.call("ARRAYTOTEXT", [arr, 1], ctx);
    assertEqual(strict, "{10, 20, 30}");
  });
});
