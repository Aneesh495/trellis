/**
 * Spill allocation models, collision reasons, and result containers.
 */

import { CellCoord, RangeCoord, TMatrix, TrellisError } from "@trellis/core";

export type BlockedReason = "COLLISION_WITH_DATA" | "COLLISION_WITH_SPILL" | "OUT_OF_BOUNDS";

export interface SpillAllocation {
  readonly root: CellCoord;
  readonly range: RangeCoord;
  readonly matrix: TMatrix;
  status: "active" | "blocked";
  blockedCoord?: CellCoord;
  blockedReason?: BlockedReason;
}

export interface SpillSuccessResult {
  readonly success: true;
  readonly range: RangeCoord;
  readonly matrix: TMatrix;
  readonly previousRange?: RangeCoord;
}

export interface SpillBlockedResult {
  readonly success: false;
  readonly error: TrellisError;
  readonly blockedCoord: CellCoord;
  readonly blockedReason: BlockedReason;
  readonly attemptedRange: RangeCoord;
}

export type SpillResult = SpillSuccessResult | SpillBlockedResult;
