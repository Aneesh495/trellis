/**
 * Collision detector for dynamic array spill bounding boxes.
 */

import { CellCoord, RangeCoord, MAX_ROWS, MAX_COLS, formatCellRef } from "@trellis/core";
import { BlockedReason, SpillAllocation } from "./spill_types.js";

export interface CollisionCheckResult {
  readonly hasCollision: boolean;
  readonly blockedCoord?: CellCoord;
  readonly reason?: BlockedReason;
}

export class CollisionDetector {
  /**
   * Evaluates candidate spill range for boundary overflow and occupied cell collisions.
   */
  public checkCollision(
    root: CellCoord,
    range: RangeCoord,
    isCellBlank: (coord: CellCoord) => boolean,
    activeAllocations: Map<string, SpillAllocation>
  ): CollisionCheckResult {
    // 1. Check grid boundary limits
    if (range.endRow >= MAX_ROWS || range.endCol >= MAX_COLS) {
      return {
        hasCollision: true,
        blockedCoord: { row: Math.min(range.endRow, MAX_ROWS - 1), col: Math.min(range.endCol, MAX_COLS - 1) },
        reason: "OUT_OF_BOUNDS"
      };
    }

    const rootKey = formatCellRef(root).toUpperCase();

    // 2. Iterate non-root cells in candidate bounding box
    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        // Skip root cell itself
        if (r === root.row && c === root.col) {
          continue;
        }

        const candidateCoord: CellCoord = { row: r, col: c, sheet: root.sheet };

        // Check if cell is non-blank in underlying sheet data
        if (!isCellBlank(candidateCoord)) {
          return {
            hasCollision: true,
            blockedCoord: candidateCoord,
            reason: "COLLISION_WITH_DATA"
          };
        }

        // Check if cell is claimed by another active spill allocation
        for (const [otherRootKey, alloc] of activeAllocations.entries()) {
          if (otherRootKey === rootKey || alloc.status !== "active") continue;
          if (
            candidateCoord.row >= alloc.range.startRow &&
            candidateCoord.row <= alloc.range.endRow &&
            candidateCoord.col >= alloc.range.startCol &&
            candidateCoord.col <= alloc.range.endCol
          ) {
            return {
              hasCollision: true,
              blockedCoord: candidateCoord,
              reason: "COLLISION_WITH_SPILL"
            };
          }
        }
      }
    }

    return { hasCollision: false };
  }
}
