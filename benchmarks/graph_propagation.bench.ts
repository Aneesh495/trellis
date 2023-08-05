import { benchmark } from "./framework.js";
import { DependencyDAG, SpatialRangeIndex } from "@trellis/graph";
import { CellCoord, RangeCoord } from "@trellis/core";

// 1. Pre-build a 2,000-cell dependency chain
const chainDag = new DependencyDAG();
const chainLength = 2000;
for (let i = 0; i < chainLength - 1; i++) {
  const from: CellCoord = { row: i, col: 0, sheet: "Sheet1" };
  const to: CellCoord = { row: i + 1, col: 0, sheet: "Sheet1" };
  chainDag.setDependencies(to, [from]);
}
const chainRoot: CellCoord = { row: 0, col: 0, sheet: "Sheet1" };

// 2. Pre-build a bushy multi-tier tree DAG
const treeDag = new DependencyDAG();
const depth = 6;
const branching = 3;
let currentTier: CellCoord[] = [{ row: 0, col: 0, sheet: "Sheet1" }];
let nextRow = 1;

for (let d = 0; d < depth; d++) {
  const nextTier: CellCoord[] = [];
  for (const parent of currentTier) {
    for (let b = 0; b < branching; b++) {
      const child: CellCoord = { row: nextRow++, col: b, sheet: "Sheet1" };
      treeDag.setDependencies(child, [parent]);
      nextTier.push(child);
    }
  }
  currentTier = nextTier;
}
const treeRoot: CellCoord = { row: 0, col: 0, sheet: "Sheet1" };

// 3. Spatial range index queries
const spatialIndex = new SpatialRangeIndex();
for (let i = 0; i < 500; i++) {
  const range: RangeCoord = {
    startRow: i * 2,
    startCol: 0,
    endRow: i * 2 + 10,
    endCol: 5,
    sheet: "Sheet1"
  };
  spatialIndex.insert(`SUM_CELL_${i}`, range);
}
const queryTarget: CellCoord = { row: 250, col: 2, sheet: "Sheet1" };

benchmark("Graph: 2,000-Node Linear Chain Recalc Planning", () => {
  chainDag.planRecalculation([chainRoot]);
}, { warmupIterations: 100, minDurationMs: 150 });

benchmark("Graph: Bushy Multi-Tier Tree Wave Scheduling", () => {
  treeDag.planRecalculation([treeRoot]);
}, { warmupIterations: 100, minDurationMs: 150 });

benchmark("Graph: Spatial Range Interval Query Throughput", () => {
  spatialIndex.queryCell(queryTarget);
}, { warmupIterations: 500, minDurationMs: 150 });
