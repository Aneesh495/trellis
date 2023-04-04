import { describe, it, assert, assertEqual, assertDeepEqual } from "./framework.js";
import {
  DependencyDAG,
  SpatialRangeIndex,
  TarjanCycleDetector,
  DependencyNode
} from "../packages/graph/src/index.js";
import { parseCellRef, parseRangeRef } from "@trellis/core";

describe("Graph: Spatial Range Indexer", () => {
  it("indexes ranges and queries overlapping cells rapidly", () => {
    const idx = new SpatialRangeIndex();
    const range1 = parseRangeRef("A1:C10");
    const range2 = parseRangeRef("B5:E20");

    idx.insert("SUM_CELL_1", range1);
    idx.insert("SUM_CELL_2", range2);

    // B8 is inside both A1:C10 and B5:E20
    const b8Match = idx.queryCell(parseCellRef("B8"));
    assert(b8Match.has("SUM_CELL_1"));
    assert(b8Match.has("SUM_CELL_2"));

    // A2 is inside range1 but not range2
    const a2Match = idx.queryCell(parseCellRef("A2"));
    assert(a2Match.has("SUM_CELL_1"));
    assert(!a2Match.has("SUM_CELL_2"));

    // Z100 is outside both
    const z100Match = idx.queryCell(parseCellRef("Z100"));
    assertEqual(z100Match.size, 0);

    // Remove range1
    idx.remove("SUM_CELL_1");
    const b8After = idx.queryCell(parseCellRef("B8"));
    assert(!b8After.has("SUM_CELL_1"));
    assert(b8After.has("SUM_CELL_2"));
  });
});

describe("Graph: Tarjan SCC Cycle Detection", () => {
  it("detects direct 2-node circular dependencies", () => {
    const nodes = new Map<string, DependencyNode>();
    const a1 = new DependencyNode("A1", parseCellRef("A1"));
    const b1 = new DependencyNode("B1", parseCellRef("B1"));

    // A1 depends on B1, B1 depends on A1 (edges: precedent -> dependent)
    a1.addDependent("B1");
    b1.addDependent("A1");

    nodes.set("A1", a1);
    nodes.set("B1", b1);

    const detector = new TarjanCycleDetector();
    const cycles = detector.detectCycles(nodes);

    assertEqual(cycles.length, 1);
    assert(cycles[0]!.componentKeys.includes("A1"));
    assert(cycles[0]!.componentKeys.includes("B1"));
  });

  it("detects multi-node circular dependency loops", () => {
    const nodes = new Map<string, DependencyNode>();
    const nA = new DependencyNode("A1", parseCellRef("A1"));
    const nB = new DependencyNode("B1", parseCellRef("B1"));
    const nC = new DependencyNode("C1", parseCellRef("C1"));

    // A1 -> B1 -> C1 -> A1
    nA.addDependent("B1");
    nB.addDependent("C1");
    nC.addDependent("A1");

    nodes.set("A1", nA);
    nodes.set("B1", nB);
    nodes.set("C1", nC);

    const detector = new TarjanCycleDetector();
    const cycles = detector.detectCycles(nodes);

    assertEqual(cycles.length, 1);
    assertEqual(cycles[0]!.componentKeys.length, 3);
  });

  it("returns no cycles for valid directed acyclic graph", () => {
    const nodes = new Map<string, DependencyNode>();
    const a1 = new DependencyNode("A1", parseCellRef("A1"));
    const b1 = new DependencyNode("B1", parseCellRef("B1"));
    const c1 = new DependencyNode("C1", parseCellRef("C1"));

    // A1 -> B1, A1 -> C1, B1 -> C1
    a1.addDependent("B1");
    a1.addDependent("C1");
    b1.addDependent("C1");

    nodes.set("A1", a1);
    nodes.set("B1", b1);
    nodes.set("C1", c1);

    const detector = new TarjanCycleDetector();
    const cycles = detector.detectCycles(nodes);
    assertEqual(cycles.length, 0);
  });
});

describe("Graph: DependencyDAG and Incremental Wave Propagation", () => {
  it("computes topological calculation waves ensuring precedents evaluate first", () => {
    const dag = new DependencyDAG();

    const a1 = parseCellRef("A1");
    const b1 = parseCellRef("B1");
    const c1 = parseCellRef("C1");
    const d1 = parseCellRef("D1");

    // B1 depends on A1
    dag.setDependencies(b1, [a1]);
    // C1 depends on B1
    dag.setDependencies(c1, [b1]);
    // D1 depends on A1 and C1
    dag.setDependencies(d1, [a1, c1]);

    // Mutate A1
    const plan = dag.planRecalculation([a1]);

    // All downstream nodes should be dirty
    assert(plan.dirtyKeys.has("A1"));
    assert(plan.dirtyKeys.has("B1"));
    assert(plan.dirtyKeys.has("C1"));
    assert(plan.dirtyKeys.has("D1"));

    // Wave 0 should be A1
    assertDeepEqual(plan.waves[0], ["A1"]);
    // B1 must appear before C1, and C1 must appear before D1
    const order = plan.orderedKeys;
    const idxA = order.indexOf("A1");
    const idxB = order.indexOf("B1");
    const idxC = order.indexOf("C1");
    const idxD = order.indexOf("D1");

    assert(idxA < idxB, "A1 must be evaluated before B1");
    assert(idxB < idxC, "B1 must be evaluated before C1");
    assert(idxC < idxD, "C1 must be evaluated before D1");
  });

  it("triggers recalculation when cell inside a range dependency is modified", () => {
    const dag = new DependencyDAG();

    const sumCell = parseCellRef("D1");
    const range = parseRangeRef("A1:A10");

    // D1 formula is =SUM(A1:A10)
    dag.setDependencies(sumCell, [], [range]);

    // Mutating A5 should trigger recalculation of D1
    const a5 = parseCellRef("A5");
    const plan = dag.planRecalculation([a5]);

    assert(plan.dirtyKeys.has("A5"));
    assert(plan.dirtyKeys.has("D1"));
  });
});
