/**
 * Dependency graph vertex representations, state flags, and canonical key codecs.
 */

import { CellCoord, RangeCoord, formatCellRef, formatRangeRef, parseCellRef } from "@trellis/core";

export enum NodeState {
  CLEAN = 0,
  DIRTY = 1,
  CALCULATING = 2,
  HAS_CYCLE = 3
}

export class DependencyNode {
  public readonly key: string;
  public readonly coord: CellCoord;
  public precedents: Set<string> = new Set(); // Nodes this node depends upon
  public dependents: Set<string> = new Set(); // Nodes that depend upon this node
  public rangeDependencies: RangeCoord[] = []; // Ranges this node reads from
  public state: NodeState = NodeState.CLEAN;
  public level = 0; // Topological depth wave level
  public isVolatile = false;

  constructor(key: string, coord: CellCoord) {
    this.key = key.toUpperCase();
    this.coord = coord;
  }

  public addPrecedent(precedentKey: string): void {
    this.precedents.add(precedentKey.toUpperCase());
  }

  public removePrecedent(precedentKey: string): void {
    this.precedents.delete(precedentKey.toUpperCase());
  }

  public addDependent(dependentKey: string): void {
    this.dependents.add(dependentKey.toUpperCase());
  }

  public removeDependent(dependentKey: string): void {
    this.dependents.delete(dependentKey.toUpperCase());
  }

  public clearPrecedents(): void {
    this.precedents.clear();
    this.rangeDependencies = [];
    this.isVolatile = false;
  }
}

/**
 * Generates canonical uppercase lookup key for a cell coordinate (e.g. "SHEET1!$A$1" or "A1").
 */
export function cellKey(coord: CellCoord): string {
  return formatCellRef(coord).toUpperCase();
}

/**
 * Generates canonical uppercase lookup key for a range coordinate.
 */
export function rangeKey(range: RangeCoord): string {
  return formatRangeRef(range).toUpperCase();
}

/**
 * Reconstructs a CellCoord from a canonical key.
 */
export function keyToCoord(key: string): CellCoord {
  return parseCellRef(key);
}
