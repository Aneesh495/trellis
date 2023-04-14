import { describe, it, assert, assertEqual, assertDeepEqual, assertCloseTo } from "./framework.js";
import {
  RelationalTable,
  hashJoin,
  groupBy,
  PivotEngine,
  WindowFunctions
} from "../packages/relational/src/index.js";
import { TMatrix } from "@trellis/core";

describe("Relational: Table Projections and Filtering", () => {
  it("converts between matrices and relational tables", () => {
    const mat = new TMatrix([
      ["ID", "Name", "Score"],
      [101, "Alice", 95],
      [102, "Bob", 88]
    ]);

    const table = RelationalTable.fromMatrix(mat);
    assertEqual(table.rowCount(), 2);
    assertEqual(table.rows[0]!["Name"], "Alice");
    assertEqual(table.rows[1]!["Score"], 88);

    const projected = table.project(["Name", "Score"]);
    assertEqual(projected.columns.length, 2);
    assertEqual(projected.rows[0]!["ID"], undefined);
    assertEqual(projected.rows[0]!["Name"], "Alice");

    const filtered = table.filter((r) => Number(r["Score"]) > 90);
    assertEqual(filtered.rowCount(), 1);
    assertEqual(filtered.rows[0]!["Name"], "Alice");
  });
});

describe("Relational: Hash Joins", () => {
  it("performs inner, left, and full outer joins", () => {
    const employees = new RelationalTable(
      ["EmpID", "Name", "DeptID"],
      [
        { EmpID: 1, Name: "Alice", DeptID: 10 },
        { EmpID: 2, Name: "Bob", DeptID: 20 },
        { EmpID: 3, Name: "Charlie", DeptID: 99 } // Unmatched dept
      ]
    );

    const departments = new RelationalTable(
      ["DeptID", "DeptName"],
      [
        { DeptID: 10, DeptName: "Engineering" },
        { DeptID: 20, DeptName: "Research" },
        { DeptID: 30, DeptName: "Marketing" } // Unmatched employee
      ]
    );

    // Inner Join: should match EmpID 1 and 2
    const inner = hashJoin(employees, departments, "DeptID", "DeptID", "inner");
    assertEqual(inner.rowCount(), 2);
    assertEqual(inner.rows[0]!["DeptName"], "Engineering");
    assertEqual(inner.rows[1]!["DeptName"], "Research");

    // Left Join: Charlie should be present with null DeptName
    const left = hashJoin(employees, departments, "DeptID", "DeptID", "left");
    assertEqual(left.rowCount(), 3);
    const charlie = left.rows.find((r) => r["Name"] === "Charlie");
    assert(charlie !== undefined);
    assertEqual(charlie!["DeptName"], null);

    // Full Join: Marketing department should also appear
    const full = hashJoin(employees, departments, "DeptID", "DeptID", "full");
    assertEqual(full.rowCount(), 4);
  });
});

describe("Relational: GroupBy Hash Aggregations", () => {
  it("groups by category and computes aggregate statistics", () => {
    const sales = new RelationalTable(
      ["Region", "Rep", "Revenue"],
      [
        { Region: "East", Rep: "Alice", Revenue: 100 },
        { Region: "East", Rep: "Bob", Revenue: 200 },
        { Region: "West", Rep: "Charlie", Revenue: 300 },
        { Region: "West", Rep: "Dave", Revenue: 150 }
      ]
    );

    const grouped = groupBy(sales, ["Region"], [
      { column: "Revenue", as: "TotalRev", type: "SUM" },
      { column: "Revenue", as: "AvgRev", type: "AVERAGE" },
      { column: "Revenue", as: "Deals", type: "COUNT" },
      { column: "Revenue", as: "MinRev", type: "MIN" },
      { column: "Revenue", as: "MaxRev", type: "MAX" }
    ]);

    assertEqual(grouped.rowCount(), 2);

    const east = grouped.rows.find((r) => r["Region"] === "East");
    assert(east !== undefined);
    assertEqual(east!["TotalRev"], 300);
    assertEqual(east!["AvgRev"], 150);
    assertEqual(east!["Deals"], 2);
    assertEqual(east!["MinRev"], 100);
    assertEqual(east!["MaxRev"], 200);
  });
});

describe("Relational: Multi-Dimensional Pivot Engine", () => {
  it("computes pivot table grid with row/column dimensions and grand totals", () => {
    const transactions = new RelationalTable(
      ["Region", "Quarter", "Amount"],
      [
        { Region: "North", Quarter: "Q1", Amount: 1000 },
        { Region: "North", Quarter: "Q2", Amount: 1500 },
        { Region: "South", Quarter: "Q1", Amount: 2000 },
        { Region: "South", Quarter: "Q2", Amount: 2500 }
      ]
    );

    const pivotMat = PivotEngine.computePivot(transactions, {
      rowFields: ["Region"],
      columnFields: ["Quarter"],
      values: [{ column: "Amount", aggregation: "SUM", label: "Sales" }],
      showGrandTotals: true
    });

    // Check dimensions
    assert(pivotMat.rowCount >= 4); // Header + 2 data rows + Grand total
    const grid = pivotMat.toArray();

    // Verify row headers
    assertEqual(grid[1]![0], "North");
    assertEqual(grid[2]![0], "South");
    assertEqual(grid[3]![0], "Grand Total");

    // North Q1 = 1000, Q2 = 1500, Total = 2500
    assertEqual(grid[1]![1], 1000);
    assertEqual(grid[1]![2], 1500);
    assertEqual(grid[1]![3], 2500);

    // South Q1 = 2000, Q2 = 2500, Total = 4500
    assertEqual(grid[2]![1], 2000);
    assertEqual(grid[2]![2], 2500);
    assertEqual(grid[2]![3], 4500);

    // Grand totals: Q1 = 3000, Q2 = 4000, Overall = 7000
    assertEqual(grid[3]![1], 3000);
    assertEqual(grid[3]![2], 4000);
    assertEqual(grid[3]![3], 7000);
  });
});

describe("Relational: Analytical Window Functions", () => {
  it("computes row numbers, competition ranks, running sums, and moving averages", () => {
    const table = new RelationalTable(
      ["Student", "Score"],
      [
        { Student: "Alice", Score: 95 },
        { Student: "Bob", Score: 85 },
        { Student: "Charlie", Score: 85 },
        { Student: "Dave", Score: 70 }
      ]
    );

    const rowNums = WindowFunctions.rowNumber(table);
    assertDeepEqual(rowNums, [1, 2, 3, 4]);

    // Rank descending by Score: 95 -> 1, 85 -> 2, 85 -> 2, 70 -> 4
    const ranks = WindowFunctions.rank(table, "Score", -1);
    assertDeepEqual(ranks, [1, 2, 2, 4]);

    const running = WindowFunctions.runningSum(table, "Score");
    assertDeepEqual(running, [95, 180, 265, 335]);

    const moving = WindowFunctions.movingAverage(table, "Score", 2);
    assertEqual(moving[0], 95);
    assertEqual(moving[1], 90); // (95 + 85) / 2 = 90
    assertEqual(moving[2], 85); // (85 + 85) / 2 = 85
    assertCloseTo(moving[3]!, 77.5, 0.01); // (85 + 70) / 2 = 77.5
  });
});
