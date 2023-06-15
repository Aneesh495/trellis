import { describe, it, assert, assertEqual, assertCloseTo } from "./framework.js";
import { TrellisEngine } from "@trellis/engine";
import { loadFinancialModel } from "../web/src/models/financial_model.js";
import { loadSalesDataset } from "../web/src/models/pivot_demo.js";

describe("TrellisWeb: Financial DCF Valuation Model", () => {
  it("should calculate projected revenues, gross profits, and enterprise value", () => {
    const engine = new TrellisEngine();
    loadFinancialModel(engine);

    // Year 1 Revenue = 100.0
    assertEqual(engine.getCellValue("Model", "B7"), 100);

    // Year 2 Revenue = 100 * 1.15 = 115.0
    assertCloseTo(engine.getCellValue("Model", "C7") as number, 115.0, 1e-4);

    // Year 1 COGS = 100 * 0.40 = 40.0
    assertCloseTo(engine.getCellValue("Model", "B8") as number, 40.0, 1e-4);

    // Year 1 Gross Profit = 100 - 40 = 60.0
    assertCloseTo(engine.getCellValue("Model", "B9") as number, 60.0, 1e-4);

    // Year 1 EBIT = 60 - 25 = 35.0
    assertCloseTo(engine.getCellValue("Model", "B11") as number, 35.0, 1e-4);

    // Enterprise Value should be positive and calculated via NPV + PV of Terminal Value
    const ev = engine.getCellValue("Model", "B18") as number;
    assert(typeof ev === "number" && ev > 200, "Enterprise Value must be computed and positive");
  });
});

describe("TrellisWeb: Multi-Dimensional Sales Dataset and Analytics", () => {
  it("should calculate categorical revenue totals using SUMIF dynamic aggregations", () => {
    const engine = new TrellisEngine();
    loadSalesDataset(engine);

    // Hardware total revenue
    // MacBook Pro (5 * 2499 = 12495) + Mac Studio (3 * 1999 = 5997) + iPad Pro (9 * 899 = 8091) + MacBook Air (10 * 1199 = 11990) + MacBook Pro (6 * 2499 = 14994)
    // Formula calculates sum of price column where Category == "Hardware"
    const hardwareRevenue = engine.getCellValue("SalesData", "H2") as number;
    assert(typeof hardwareRevenue === "number" && hardwareRevenue > 0, "Hardware revenue should calculate");

    const mobileRevenue = engine.getCellValue("SalesData", "H3") as number;
    assert(typeof mobileRevenue === "number" && mobileRevenue > 0, "Mobile revenue should calculate");
  });
});
