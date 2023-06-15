/**
 * Preloaded multi-dimensional retail sales dataset and analytical pivot report.
 */

import { TrellisEngine } from "@trellis/engine";

export function loadSalesDataset(engine: TrellisEngine): void {
  const sheet = "SalesData";
  if (!engine.workbook.getSheet(sheet)) {
    engine.workbook.addSheet(sheet);
  }

  engine.batch((b) => {
    // Column Headers
    b.setCell(sheet, { row: 0, col: 0 }, "Region");
    b.setCell(sheet, { row: 0, col: 1 }, "Category");
    b.setCell(sheet, { row: 0, col: 2 }, "Product");
    b.setCell(sheet, { row: 0, col: 3 }, "Sales");
    b.setCell(sheet, { row: 0, col: 4 }, "Units");

    const rows = [
      ["North", "Hardware", "MacBook Pro", "2499.00", "5"],
      ["North", "Mobile", "iPhone 15", "999.00", "12"],
      ["North", "Audio", "AirPods Pro", "249.00", "25"],
      ["South", "Hardware", "Mac Studio", "1999.00", "3"],
      ["South", "Mobile", "iPhone 15", "999.00", "8"],
      ["South", "Wearables", "Apple Watch", "399.00", "14"],
      ["East", "Hardware", "iPad Pro", "899.00", "9"],
      ["East", "Audio", "AirPods Max", "549.00", "4"],
      ["East", "Mobile", "iPhone 15", "999.00", "15"],
      ["West", "Hardware", "MacBook Air", "1199.00", "10"],
      ["West", "Mobile", "iPhone 15", "999.00", "20"],
      ["West", "Wearables", "Apple Watch", "399.00", "18"],
      ["Central", "Hardware", "MacBook Pro", "2499.00", "6"],
      ["Central", "Mobile", "iPhone 15", "999.00", "11"],
      ["Central", "Audio", "AirPods Pro", "249.00", "16"]
    ];

    for (let r = 0; r < rows.length; r++) {
      const rowData = rows[r]!;
      for (let c = 0; c < rowData.length; c++) {
        b.setCell(sheet, { row: r + 1, col: c }, rowData[c]!);
      }
    }

    // Analytics Summary Block
    b.setCell(sheet, { row: 0, col: 6 }, "Category");
    b.setCell(sheet, { row: 0, col: 7 }, "Total Revenue");

    b.setCell(sheet, { row: 1, col: 6 }, "Hardware");
    b.setCell(sheet, { row: 1, col: 7 }, '=SUMIF(B2:B16, "Hardware", D2:D16)');

    b.setCell(sheet, { row: 2, col: 6 }, "Mobile");
    b.setCell(sheet, { row: 2, col: 7 }, '=SUMIF(B2:B16, "Mobile", D2:D16)');

    b.setCell(sheet, { row: 3, col: 6 }, "Audio");
    b.setCell(sheet, { row: 3, col: 7 }, '=SUMIF(B2:B16, "Audio", D2:D16)');

    b.setCell(sheet, { row: 4, col: 6 }, "Wearables");
    b.setCell(sheet, { row: 4, col: 7 }, '=SUMIF(B2:B16, "Wearables", D2:D16)');
  });
}
