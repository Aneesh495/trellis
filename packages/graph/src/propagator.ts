/**
 * Incremental dirty wave propagation and topological wave level scheduler.
 * Computes deterministic recalculation waves using Kahn's in-degree reduction algorithm.
 */

import { DependencyNode, keyToCoord } from "./node.js";
import { SpatialRangeIndex } from "./spatial_index.js";

export interface CalculationPlan {
  readonly dirtyKeys: Set<string>;
  readonly waves: string[][];
  readonly orderedKeys: string[];
  readonly unreachedCyclicKeys: string[];
}

export class DirtyPropagator {
  /**
   * Propagates dirty state transitively from modified roots and computes an ordered calculation plan.
   */
  public computeCalculationPlan(
    mutatedRootKeys: string[],
    nodes: Map<string, DependencyNode>,
    spatialIndex: SpatialRangeIndex
  ): CalculationPlan {
    // 1. Transitively identify all affected downstream nodes (BFS / queue)
    const dirtyKeys = new Set<string>();
    const queue: string[] = [];

    for (const rootKey of mutatedRootKeys) {
      const normKey = rootKey.toUpperCase();
      if (!dirtyKeys.has(normKey)) {
        dirtyKeys.add(normKey);
        queue.push(normKey);
      }
    }

    let head = 0;
    while (head < queue.length) {
      const currentKey = queue[head++]!;
      const currentNode = nodes.get(currentKey);
      const coord = currentNode ? currentNode.coord : keyToCoord(currentKey);

      // Direct dependents
      if (currentNode) {
        for (const depKey of currentNode.dependents) {
          if (!dirtyKeys.has(depKey)) {
            dirtyKeys.add(depKey);
            queue.push(depKey);
          }
        }
      }

      // Spatial range dependencies: find formulas reading ranges covering this cell
      const rangeConsumerKeys = spatialIndex.queryCell(coord);
      for (const rKey of rangeConsumerKeys) {
        if (!dirtyKeys.has(rKey)) {
          dirtyKeys.add(rKey);
          queue.push(rKey);
        }
      }
    }

    // 2. Kahn's Algorithm on the dirty subgraph to produce topological waves
    // Calculate in-degrees considering only edges within the dirtyKeys set
    const inDegrees: Map<string, number> = new Map();
    for (const key of dirtyKeys) {
      inDegrees.set(key, 0);
    }

    for (const key of dirtyKeys) {
      const node = nodes.get(key);
      if (node) {
        for (const depKey of node.dependents) {
          if (dirtyKeys.has(depKey)) {
            inDegrees.set(depKey, (inDegrees.get(depKey) || 0) + 1);
          }
        }
      }
    }

    // Ready queue for wave 0: nodes with in-degree 0
    let currentWave: string[] = [];
    for (const [key, deg] of inDegrees.entries()) {
      if (deg === 0) {
        currentWave.push(key);
      }
    }

    const waves: string[][] = [];
    const orderedKeys: string[] = [];

    while (currentWave.length > 0) {
      waves.push(currentWave);
      const nextWave: string[] = [];

      for (const key of currentWave) {
        orderedKeys.push(key);
        const node = nodes.get(key);
        if (node) {
          for (const depKey of node.dependents) {
            if (dirtyKeys.has(depKey)) {
              const newDeg = inDegrees.get(depKey)! - 1;
              inDegrees.set(depKey, newDeg);
              if (newDeg === 0) {
                nextWave.push(depKey);
              }
            }
          }
        }
      }

      currentWave = nextWave;
    }

    // Any remaining nodes in dirtyKeys with in-degree > 0 are part of unresolvable cycles
    const unreachedCyclicKeys: string[] = [];
    for (const [key, deg] of inDegrees.entries()) {
      if (deg > 0) {
        unreachedCyclicKeys.push(key);
      }
    }

    return {
      dirtyKeys,
      waves,
      orderedKeys,
      unreachedCyclicKeys
    };
  }
}
