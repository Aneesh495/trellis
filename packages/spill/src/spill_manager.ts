/**
 * Master manager orchestrating dynamic 2D array spill allocations, ghost cell queries, and collision recoveries.
 */

import { CellCoord, RangeCoord, TMatrix, PrimitiveValue, formatCellRef, TrellisError } from "@trellis/core";
import { SpillAllocation, SpillResult } from "./spill_types.js";
import { CollisionDetector } from "./collision.js";

export class SpillManager {
  // Map of root cell key -> SpillAllocation
  private readonly allocations: Map<string, SpillAllocation> = new Map();
  // Reverse index mapping child cell key -> root cell key
  private readonly childToRoot: Map<string, string> = new Map();
  private readonly collisionDetector: CollisionDetector = new CollisionDetector();

  /**
   * Attempts to allocate a 2D bounding box for an evaluated matrix.
   */
  public allocateSpill(
    root: CellCoord,
    matrix: TMatrix,
    isCellBlank: (coord: CellCoord) => boolean
  ): SpillResult {
    const rootKey = formatCellRef(root).toUpperCase();
    const rows = matrix.rowCount;
    const cols = matrix.colCount;

    // Single scalar 1x1 matrix does not spill outward
    if (rows <= 1 && cols <= 1) {
      this.removeSpill(root);
      return {
        success: true,
        range: {
          startRow: root.row,
          startCol: root.col,
          endRow: root.row,
          endCol: root.col,
          sheet: root.sheet
        },
        matrix
      };
    }

    const candidateRange: RangeCoord = {
      startRow: root.row,
      startCol: root.col,
      endRow: root.row + rows - 1,
      endCol: root.col + cols - 1,
      sheet: root.sheet
    };

    const previousAlloc = this.allocations.get(rootKey);
    const previousRange = previousAlloc ? previousAlloc.range : undefined;

    // Check for collisions
    const check = this.collisionDetector.checkCollision(root, candidateRange, isCellBlank, this.allocations);

    if (check.hasCollision && check.blockedCoord && check.reason) {
      const err = TrellisError.spillError(
        `Spill range blocked at ${formatCellRef(check.blockedCoord)} (${check.reason})`,
        formatCellRef(root)
      );

      this.allocations.set(rootKey, {
        root,
        range: candidateRange,
        matrix,
        status: "blocked",
        blockedCoord: check.blockedCoord,
        blockedReason: check.reason
      });

      // Clear previous child mappings if any
      this.clearChildMappings(rootKey);

      return {
        success: false,
        error: err,
        blockedCoord: check.blockedCoord,
        blockedReason: check.reason,
        attemptedRange: candidateRange
      };
    }

    // Successful allocation
    this.clearChildMappings(rootKey);

    const alloc: SpillAllocation = {
      root,
      range: candidateRange,
      matrix,
      status: "active"
    };

    this.allocations.set(rootKey, alloc);

    // Index all non-root child cells
    for (let r = candidateRange.startRow; r <= candidateRange.endRow; r++) {
      for (let c = candidateRange.startCol; c <= candidateRange.endCol; c++) {
        if (r === root.row && c === root.col) continue;
        const childCoord: CellCoord = { row: r, col: c, sheet: root.sheet };
        const childKey = formatCellRef(childCoord).toUpperCase();
        this.childToRoot.set(childKey, rootKey);
      }
    }

    return {
      success: true,
      range: candidateRange,
      matrix,
      previousRange
    };
  }

  /**
   * De-registers an active or blocked spill allocation.
   */
  public removeSpill(root: CellCoord): RangeCoord | undefined {
    const rootKey = formatCellRef(root).toUpperCase();
    const existing = this.allocations.get(rootKey);
    if (!existing) return undefined;

    this.clearChildMappings(rootKey);
    this.allocations.delete(rootKey);
    return existing.range;
  }

  public getSpillRange(root: CellCoord): RangeCoord | undefined {
    const rootKey = formatCellRef(root).toUpperCase();
    const alloc = this.allocations.get(rootKey);
    return alloc && alloc.status === "active" ? alloc.range : undefined;
  }

  public getSpillMatrix(root: CellCoord): TMatrix | undefined {
    const rootKey = formatCellRef(root).toUpperCase();
    const alloc = this.allocations.get(rootKey);
    return alloc && alloc.status === "active" ? alloc.matrix : undefined;
  }

  public isSpillChild(coord: CellCoord): boolean {
    const key = formatCellRef(coord).toUpperCase();
    return this.childToRoot.has(key);
  }

  public isGhostCell(coord: CellCoord): boolean {
    return this.isSpillChild(coord);
  }

  public getBlockedSpillRootsAt(coord: CellCoord): CellCoord[] {
    const key = formatCellRef(coord).toUpperCase();
    const roots: CellCoord[] = [];
    for (const alloc of this.allocations.values()) {
      if (alloc.status === "blocked" && alloc.blockedCoord) {
        if (formatCellRef(alloc.blockedCoord).toUpperCase() === key) {
          roots.push(alloc.root);
        }
      }
    }
    return roots;
  }

  public getSpillRootForCell(coord: CellCoord): CellCoord | undefined {
    const key = formatCellRef(coord).toUpperCase();
    const rootKey = this.childToRoot.get(key);
    if (!rootKey) return undefined;
    const alloc = this.allocations.get(rootKey);
    return alloc ? alloc.root : undefined;
  }

  /**
   * Resolves the evaluated value for a cell populated via dynamic array spill.
   */
  public getSpillValue(coord: CellCoord): PrimitiveValue {
    const key = formatCellRef(coord).toUpperCase();
    const rootKey = this.childToRoot.get(key);
    if (!rootKey) return null;

    const alloc = this.allocations.get(rootKey);
    if (!alloc || alloc.status !== "active") return null;

    const rowOffset = coord.row - alloc.root.row;
    const colOffset = coord.col - alloc.root.col;
    return alloc.matrix.get(rowOffset, colOffset);
  }

  private clearChildMappings(rootKey: string): void {
    for (const [childKey, rKey] of this.childToRoot.entries()) {
      if (rKey === rootKey) {
        this.childToRoot.delete(childKey);
      }
    }
  }

  public clear(): void {
    this.allocations.clear();
    this.childToRoot.clear();
  }
}
