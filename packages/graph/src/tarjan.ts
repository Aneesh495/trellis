/**
 * Tarjan's Strongly Connected Components algorithm for circular dependency detection.
 * Identifies and isolates cyclic formula subgraphs in O(V + E) time.
 */

import { DependencyNode } from "./node.js";

export interface CycleResult {
  readonly componentKeys: string[];
  readonly cyclePath: string[];
}

export class TarjanCycleDetector {
  private index = 0;
  private readonly indices: Map<string, number> = new Map();
  private readonly lowlinks: Map<string, number> = new Map();
  private readonly onStack: Set<string> = new Set();
  private readonly stack: string[] = [];
  private readonly stronglyConnectedComponents: string[][] = [];

  /**
   * Executes Tarjan's algorithm across the provided nodes map.
   * Directed edges represent dependency: precedent -> dependent.
   */
  public detectCycles(nodes: Map<string, DependencyNode>): CycleResult[] {
    this.index = 0;
    this.indices.clear();
    this.lowlinks.clear();
    this.onStack.clear();
    this.stack.length = 0;
    this.stronglyConnectedComponents.length = 0;

    for (const [key] of nodes.entries()) {
      if (!this.indices.has(key)) {
        this.strongConnect(key, nodes);
      }
    }

    const results: CycleResult[] = [];
    for (const component of this.stronglyConnectedComponents) {
      // A component is cyclic if it has > 1 node, or has 1 node that references itself
      if (component.length > 1) {
        const path = this.findCyclePath(component, nodes);
        results.push({
          componentKeys: component,
          cyclePath: path
        });
      } else if (component.length === 1) {
        const singleKey = component[0]!;
        const node = nodes.get(singleKey);
        if (node && node.dependents.has(singleKey)) {
          results.push({
            componentKeys: component,
            cyclePath: [singleKey, singleKey]
          });
        }
      }
    }

    return results;
  }

  private strongConnect(uKey: string, nodes: Map<string, DependencyNode>): void {
    this.indices.set(uKey, this.index);
    this.lowlinks.set(uKey, this.index);
    this.index++;
    this.stack.push(uKey);
    this.onStack.add(uKey);

    const uNode = nodes.get(uKey);
    if (uNode) {
      // Follow outgoing edges from precedent to dependent
      for (const vKey of uNode.dependents) {
        if (!this.indices.has(vKey)) {
          // Successor v has not yet been visited; recurse on it
          this.strongConnect(vKey, nodes);
          this.lowlinks.set(uKey, Math.min(this.lowlinks.get(uKey)!, this.lowlinks.get(vKey)!));
        } else if (this.onStack.has(vKey)) {
          // Successor v is on stack and hence in current SCC
          this.lowlinks.set(uKey, Math.min(this.lowlinks.get(uKey)!, this.indices.get(vKey)!));
        }
      }
    }

    // If u is a root node, pop the stack and generate an SCC
    if (this.lowlinks.get(uKey) === this.indices.get(uKey)) {
      const component: string[] = [];
      let wKey: string;
      do {
        wKey = this.stack.pop()!;
        this.onStack.delete(wKey);
        component.push(wKey);
      } while (wKey !== uKey);
      this.stronglyConnectedComponents.push(component);
    }
  }

  /**
   * Reconstructs an ordered directed cycle loop within a strongly connected component.
   */
  private findCyclePath(component: string[], nodes: Map<string, DependencyNode>): string[] {
    const compSet = new Set(component);
    const startKey = component[0]!;
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (curr: string): boolean => {
      path.push(curr);
      visited.add(curr);

      const node = nodes.get(curr);
      if (node) {
        for (const next of node.dependents) {
          if (!compSet.has(next)) continue;
          if (next === startKey && path.length > 1) {
            path.push(startKey);
            return true;
          }
          if (!visited.has(next)) {
            if (dfs(next)) return true;
          }
        }
      }

      path.pop();
      return false;
    };

    if (dfs(startKey)) {
      return path;
    }

    return [...component, component[0]!];
  }
}
