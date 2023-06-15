/**
 * Preloaded 5-Year Discounted Cash Flow (DCF) Financial Model.
 */

import { TrellisEngine } from "@trellis/engine";

export function loadFinancialModel(engine: TrellisEngine): void {
  const sheet = "Model";
  if (!engine.workbook.getSheet(sheet)) {
    engine.workbook.addSheet(sheet);
  }

  engine.batch((b) => {
    // Model Assumptions
    b.setCell(sheet, { row: 0, col: 0 }, "DCF Valuation Model (5-Year Forecast)");
    b.setCell(sheet, { row: 1, col: 0 }, "Discount Rate (WACC)");
    b.setCell(sheet, { row: 1, col: 1 }, "0.095"); // 9.5%
    b.setCell(sheet, { row: 2, col: 0 }, "Perpetual Growth Rate");
    b.setCell(sheet, { row: 2, col: 1 }, "0.025"); // 2.5%
    b.setCell(sheet, { row: 3, col: 0 }, "Tax Rate");
    b.setCell(sheet, { row: 3, col: 1 }, "0.21"); // 21%

    // Timeline Header (Year 1 to Year 5)
    b.setCell(sheet, { row: 5, col: 0 }, "Financial Metrics ($M)");
    b.setCell(sheet, { row: 5, col: 1 }, "Year 1");
    b.setCell(sheet, { row: 5, col: 2 }, "Year 2");
    b.setCell(sheet, { row: 5, col: 3 }, "Year 3");
    b.setCell(sheet, { row: 5, col: 4 }, "Year 4");
    b.setCell(sheet, { row: 5, col: 5 }, "Year 5");

    // Revenue Forecast (Starting at $100M with 15% annual growth)
    b.setCell(sheet, { row: 6, col: 0 }, "Gross Revenue");
    b.setCell(sheet, { row: 6, col: 1 }, "100.0");
    b.setCell(sheet, { row: 6, col: 2 }, "=B7 * 1.15");
    b.setCell(sheet, { row: 6, col: 3 }, "=C7 * 1.15");
    b.setCell(sheet, { row: 6, col: 4 }, "=D7 * 1.15");
    b.setCell(sheet, { row: 6, col: 5 }, "=E7 * 1.15");

    // COGS (40% of Revenue)
    b.setCell(sheet, { row: 7, col: 0 }, "Cost of Goods Sold (COGS)");
    b.setCell(sheet, { row: 7, col: 1 }, "=B7 * 0.40");
    b.setCell(sheet, { row: 7, col: 2 }, "=C7 * 0.40");
    b.setCell(sheet, { row: 7, col: 3 }, "=D7 * 0.40");
    b.setCell(sheet, { row: 7, col: 4 }, "=E7 * 0.40");
    b.setCell(sheet, { row: 7, col: 5 }, "=F7 * 0.40");

    // Gross Profit
    b.setCell(sheet, { row: 8, col: 0 }, "Gross Profit");
    b.setCell(sheet, { row: 8, col: 1 }, "=B7 - B8");
    b.setCell(sheet, { row: 8, col: 2 }, "=C7 - C8");
    b.setCell(sheet, { row: 8, col: 3 }, "=D7 - D8");
    b.setCell(sheet, { row: 8, col: 4 }, "=E7 - E8");
    b.setCell(sheet, { row: 8, col: 5 }, "=F7 - F8");

    // Operating Expenses (SG&A + R&D = 25% of Revenue)
    b.setCell(sheet, { row: 9, col: 0 }, "Operating Expenses (OPEX)");
    b.setCell(sheet, { row: 9, col: 1 }, "=B7 * 0.25");
    b.setCell(sheet, { row: 9, col: 2 }, "=C7 * 0.25");
    b.setCell(sheet, { row: 9, col: 3 }, "=D7 * 0.25");
    b.setCell(sheet, { row: 9, col: 4 }, "=E7 * 0.25");
    b.setCell(sheet, { row: 9, col: 5 }, "=F7 * 0.25");

    // Operating Income (EBIT)
    b.setCell(sheet, { row: 10, col: 0 }, "Operating Income (EBIT)");
    b.setCell(sheet, { row: 10, col: 1 }, "=B9 - B10");
    b.setCell(sheet, { row: 10, col: 2 }, "=C9 - C10");
    b.setCell(sheet, { row: 10, col: 3 }, "=D9 - D10");
    b.setCell(sheet, { row: 10, col: 4 }, "=E9 - E10");
    b.setCell(sheet, { row: 10, col: 5 }, "=F9 - F10");

    // Unlevered Free Cash Flow (EBIT * (1 - TaxRate))
    b.setCell(sheet, { row: 11, col: 0 }, "Free Cash Flow (FCF)");
    b.setCell(sheet, { row: 11, col: 1 }, "=B11 * (1 - $B$4)");
    b.setCell(sheet, { row: 11, col: 2 }, "=C11 * (1 - $B$4)");
    b.setCell(sheet, { row: 11, col: 3 }, "=D11 * (1 - $B$4)");
    b.setCell(sheet, { row: 11, col: 4 }, "=E11 * (1 - $B$4)");
    b.setCell(sheet, { row: 11, col: 5 }, "=F11 * (1 - $B$4)");

    // Valuation Outputs
    b.setCell(sheet, { row: 13, col: 0 }, "Valuation Summary ($M)");
    b.setCell(sheet, { row: 14, col: 0 }, "PV of 5-Year Cash Flows");
    b.setCell(sheet, { row: 14, col: 1 }, "=NPV($B$2, B12:F12)");

    b.setCell(sheet, { row: 15, col: 0 }, "Terminal Value (Perpetuity)");
    b.setCell(sheet, { row: 15, col: 1 }, "=(F12 * (1 + $B$3)) / ($B$2 - $B$3)");

    b.setCell(sheet, { row: 16, col: 0 }, "PV of Terminal Value");
    b.setCell(sheet, { row: 16, col: 1 }, "=B16 / ((1 + $B$2) ^ 5)");

    b.setCell(sheet, { row: 17, col: 0 }, "Enterprise Value");
    b.setCell(sheet, { row: 17, col: 1 }, "=B15 + B17");
  });
}
