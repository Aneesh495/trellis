/**
 * Spatial 2D interval grid index for rapid range dependency invalidation.
 * Maps cell mutations to overlapping range consumers in O(log N + K) time.
 */

import { CellCoord, RangeCoord, rangeContainsCell } from "@trellis/core";

const BUCKET_SIZE = 64; // Grid partitioning cell bucket dimension

interface RangeEntry {
  readonly dependentKey: string;
  readonly range: RangeCoord;
}

export class SpatialRangeIndex {
  // Map of sheet -> bucketKey -> RangeEntry[]
  private readonly buckets: Map<string, Map<string, RangeEntry[]>> = new Map();
  // Map of dependentKey -> RangeCoord[]
  private readonly entriesByDependent: Map<string, RangeCoord[]> = new Map();

  /**
   * Registers a range dependency consumed by a dependent cell.
   */
  public insert(dependentKey: string, range: RangeCoord): void {
    const key = dependentKey.toUpperCase();
    const sheet = (range.sheet || "DEFAULT").toUpperCase();

    let sheetBuckets = this.buckets.get(sheet);
    if (!sheetBuckets) {
      sheetBuckets = new Map();
      this.buckets.set(sheet, sheetBuckets);
    }

    const rStartBucket = Math.floor(range.startRow / BUCKET_SIZE);
    const rEndBucket = Math.floor(range.endRow / BUCKET_SIZE);
    const cStartBucket = Math.floor(range.startCol / BUCKET_SIZE);
    const cEndBucket = Math.floor(range.endCol / BUCKET_SIZE);

    const entry: RangeEntry = { dependentKey: key, range };

    for (let rB = rStartBucket; rB <= rEndBucket; rB++) {
      for (let cB = cStartBucket; cB <= cEndBucket; cB++) {
        const bKey = `${rB}:${cB}`;
        let list = sheetBuckets.get(bKey);
        if (!list) {
          list = [];
          sheetBuckets.set(bKey, list);
        }
        list.push(entry);
      }
    }

    let existingRanges = this.entriesByDependent.get(key);
    if (!existingRanges) {
      existingRanges = [];
      this.entriesByDependent.set(key, existingRanges);
    }
    existingRanges.push(range);
  }

  /**
   * Removes all range dependencies associated with a dependent cell.
   */
  public remove(dependentKey: string): void {
    const key = dependentKey.toUpperCase();
    const ranges = this.entriesByDependent.get(key);
    if (!ranges) return;

    for (const range of ranges) {
      const sheet = (range.sheet || "DEFAULT").toUpperCase();
      const sheetBuckets = this.buckets.get(sheet);
      if (!sheetBuckets) continue;

      const rStartBucket = Math.floor(range.startRow / BUCKET_SIZE);
      const rEndBucket = Math.floor(range.endRow / BUCKET_SIZE);
      const cStartBucket = Math.floor(range.startCol / BUCKET_SIZE);
      const cEndBucket = Math.floor(range.endCol / BUCKET_SIZE);

      for (let rB = rStartBucket; rB <= rEndBucket; rB++) {
        for (let cB = cStartBucket; cB <= cEndBucket; cB++) {
          const bKey = `${rB}:${cB}`;
          const list = sheetBuckets.get(bKey);
          if (list) {
            sheetBuckets.set(
              bKey,
              list.filter((e) => e.dependentKey !== key)
            );
          }
        }
      }
    }

    this.entriesByDependent.delete(key);
  }

  /**
   * Queries all dependent cell keys whose range dependencies cover the specified cell coordinate.
   */
  public queryCell(cell: CellCoord): Set<string> {
    const matchingDependents = new Set<string>();
    const sheet = (cell.sheet || "DEFAULT").toUpperCase();
    const sheetBuckets = this.buckets.get(sheet);
    if (!sheetBuckets) return matchingDependents;

    const rB = Math.floor(cell.row / BUCKET_SIZE);
    const cB = Math.floor(cell.col / BUCKET_SIZE);
    const bKey = `${rB}:${cB}`;

    const candidates = sheetBuckets.get(bKey);
    if (!candidates) return matchingDependents;

    for (const candidate of candidates) {
      if (rangeContainsCell(candidate.range, cell)) {
        matchingDependents.add(candidate.dependentKey);
      }
    }

    return matchingDependents;
  }

  public clear(): void {
    this.buckets.clear();
    this.entriesByDependent.clear();
  }
}
