/**
 * Primary Dependency DAG container managing vertices, edges, spatial ranges, and cycle resolution.
 */

import { DependencyNode, cellKey, keyToCoord } from "./node.js";
import { SpatialRangeIndex } from "./spatial_index.js";
import { TarjanCycleDetector, CycleResult } from "./tarjan.js";
import { DirtyPropagator, CalculationPlan } from "./propagator.js";
import { CellCoord, RangeCoord } from "@trellis/core";

export class DependencyDAG {
  private readonly nodes: Map<string, DependencyNode> = new Map();
  private readonly spatialIndex: SpatialRangeIndex = new SpatialRangeIndex();
  private readonly cycleDetector: TarjanCycleDetector = new TarjanCycleDetector();
  private readonly propagator: DirtyPropagator = new DirtyPropagator();
  private readonly volatileKeys: Set<string> = new Set();

  /**
   * Retrieves or instantiates a DependencyNode for the given coordinate.
   */
  public getOrCreateNode(coord: CellCoord): DependencyNode {
    const key = cellKey(coord);
    let node = this.nodes.get(key);
    if (!node) {
      node = new DependencyNode(key, coord);
      this.nodes.set(key, node);
    }
    return node;
  }

  public getNode(key: string): DependencyNode | undefined {
    return this.nodes.get(key.toUpperCase());
  }

  public getAllNodes(): ReadonlyMap<string, DependencyNode> {
    return this.nodes;
  }

  /**
   * Configures precedents and range dependencies for a consumer cell node.
   */
  public setDependencies(
    cell: CellCoord,
    precedents: CellCoord[],
    ranges: RangeCoord[] = [],
    isVolatile = false
  ): void {
    const node = this.getOrCreateNode(cell);

    // 1. Remove previous incoming edges
    for (const precKey of node.precedents) {
      const precNode = this.nodes.get(precKey);
      if (precNode) {
        precNode.removeDependent(node.key);
      }
    }
    this.spatialIndex.remove(node.key);
    node.clearPrecedents();

    // 2. Add direct cell precedents
    for (const prec of precedents) {
      const precKey = cellKey(prec);
      const precNode = this.getOrCreateNode(prec);
      node.addPrecedent(precKey);
      precNode.addDependent(node.key);
    }

    // 3. Add spatial range dependencies
    for (const range of ranges) {
      node.rangeDependencies.push(range);
      this.spatialIndex.insert(node.key, range);
    }

    // 4. Volatile registration
    node.isVolatile = isVolatile;
    if (isVolatile) {
      this.volatileKeys.add(node.key);
    } else {
      this.volatileKeys.delete(node.key);
    }
  }

  /**
   * Clears incoming precedents and range dependencies for a cell while preserving its dependents.
   */
  public clearPrecedents(cell: CellCoord): void {
    const key = cellKey(cell);
    const node = this.nodes.get(key);
    if (!node) return;

    for (const precKey of node.precedents) {
      const precNode = this.nodes.get(precKey);
      if (precNode) {
        precNode.removeDependent(node.key);
      }
    }
    this.spatialIndex.remove(node.key);
    node.clearPrecedents();
    this.volatileKeys.delete(node.key);
  }

  /**
   * Removes a cell from the DAG and purges associated graph edges.
   */
  public removeCell(cell: CellCoord): void {
    const key = cellKey(cell);
    const node = this.nodes.get(key);
    if (!node) return;

    // Disconnect from precedents
    for (const precKey of node.precedents) {
      const precNode = this.nodes.get(precKey);
      if (precNode) precNode.removeDependent(node.key);
    }

    // Disconnect from dependents
    for (const depKey of node.dependents) {
      const depNode = this.nodes.get(depKey);
      if (depNode) depNode.removePrecedent(node.key);
    }

    this.spatialIndex.remove(node.key);
    this.volatileKeys.delete(node.key);
    this.nodes.delete(key);
  }

  /**
   * Calculates an incremental recalculation plan starting from mutated cells.
   */
  public planRecalculation(mutatedRoots: CellCoord[]): CalculationPlan {
    const rootKeys = mutatedRoots.map(cellKey);
    return this.propagator.computeCalculationPlan(rootKeys, this.nodes, this.spatialIndex);
  }

  /**
   * Identifies all cyclic dependency paths across the graph.
   */
  public detectCycles(): CycleResult[] {
    return this.cycleDetector.detectCycles(this.nodes);
  }

  /**
   * Returns all volatile cell coordinates requiring continuous or timer-driven updates.
   */
  public getVolatileCoords(): CellCoord[] {
    return Array.from(this.volatileKeys).map(keyToCoord);
  }

  public get size(): number {
    return this.nodes.size;
  }

  public clear(): void {
    this.nodes.clear();
    this.spatialIndex.clear();
    this.volatileKeys.clear();
  }
}
