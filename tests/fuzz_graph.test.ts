import { describe, it, assert, assertEqual } from "./framework.js";
import { DependencyDAG } from "@trellis/graph";
import { CellCoord } from "@trellis/core";

describe("Graph: Stress Testing and Cycle Injection", () => {
  let seed = 12345;
  function random(): number {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }

  function randomInt(min: number, max: number): number {
    return Math.floor(random() * (max - min + 1)) + min;
  }

  it("verifies topological wave invariant across a randomized 500-node DAG", () => {
    const dag = new DependencyDAG();
    const nodeCount = 500;
    const nodeCoords: CellCoord[] = [];

    for (let i = 0; i < nodeCount; i++) {
      nodeCoords.push({ row: i, col: 0, sheet: "Sheet1" });
    }

    // Build directed acyclic edges strictly from lower index to higher index (j > i)
    for (let i = 0; i < nodeCount; i++) {
      const precedent = nodeCoords[i]!;
      const outgoingEdges = randomInt(1, 3);
      for (let e = 0; e < outgoingEdges; e++) {
        const targetIdx = randomInt(i + 1, Math.min(nodeCount - 1, i + 30));
        if (targetIdx < nodeCount) {
          const dependent = nodeCoords[targetIdx]!;
          dag.setDependencies(dependent, [precedent]);
        }
      }
    }

    // Plan recalculation from root nodes (first 10)
    const roots = nodeCoords.slice(0, 10);
    const plan = dag.planRecalculation(roots);

    // Map each node key to its wave index
    const waveIndexMap = new Map<string, number>();
    for (let w = 0; w < plan.waves.length; w++) {
      for (const key of plan.waves[w]!) {
        waveIndexMap.set(key.toUpperCase(), w);
      }
    }

    // Invariant: for every edge (u -> v), wave(u) < wave(v)
    for (const [key, node] of dag.getAllNodes().entries()) {
      const uWave = waveIndexMap.get(key.toUpperCase());
      if (uWave === undefined) continue;

      for (const depKey of node.dependents) {
        const vWave = waveIndexMap.get(depKey.toUpperCase());
        if (vWave !== undefined) {
          assert(
            uWave < vWave,
            `Topological violation: precedent ${key} (wave ${uWave}) evaluated >= dependent ${depKey} (wave ${vWave})`
          );
        }
      }
    }
  });

  it("detects injected circular dependency loops of varying cycle sizes", () => {
    const cycleSizes = [2, 3, 5, 12, 25];

    for (const size of cycleSizes) {
      const dag = new DependencyDAG();
      const coords: CellCoord[] = [];

      for (let i = 0; i < size; i++) {
        coords.push({ row: i, col: 1, sheet: "Sheet1" });
      }

      // Chain: c0 -> c1 -> c2 -> ... -> cN-1 -> c0
      // In setDependencies(consumer, [precedents]):
      // c1 depends on c0, c2 depends on c1, ..., c0 depends on cN-1
      for (let i = 0; i < size; i++) {
        const dependent = coords[(i + 1) % size]!;
        const precedent = coords[i]!;
        dag.setDependencies(dependent, [precedent]);
      }

      const cycles = dag.detectCycles();
      assert(cycles.length > 0, `Expected cycle detection for cycle size ${size}`);

      const sccKeys = cycles[0]!.componentKeys;
      assertEqual(sccKeys.length, size);
    }
  });
});
