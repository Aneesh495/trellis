/**
 * Vectorized aggregate operations accelerated by chunk Zone Map statistics.
 */

import { Column } from "./column.js";
import { CHUNK_SIZE, Float64Chunk } from "./chunk.js";

/**
 * Calculates sum over a row range, accelerating fully covered chunks via Zone Map aggregates.
 */
export function vectorSum(column: Column, startRow: number, endRow: number): number {
  let sum = 0;
  const startChunkIdx = Math.floor(startRow / CHUNK_SIZE);
  const endChunkIdx = Math.floor(endRow / CHUNK_SIZE);

  for (let cIdx = startChunkIdx; cIdx <= endChunkIdx; cIdx++) {
    const chunk = column.getChunk(cIdx);
    if (!chunk) continue;

    const chunkStartRow = cIdx * CHUNK_SIZE;
    const chunkEndRow = chunkStartRow + CHUNK_SIZE - 1;

    // Fast path: Chunk is entirely encompassed within [startRow..endRow]
    if (chunkStartRow >= startRow && chunkEndRow <= endRow) {
      sum += chunk.zoneMap.sum;
      continue;
    }

    // Partial chunk iteration
    const localStart = Math.max(0, startRow - chunkStartRow);
    const localEnd = Math.min(CHUNK_SIZE - 1, endRow - chunkStartRow);

    if (chunk.type === "FLOAT64") {
      const fChunk = chunk as Float64Chunk;
      const data = fChunk.data;
      const mask = fChunk.nullMask;
      for (let i = localStart; i <= localEnd; i++) {
        if (!mask.isNull(i)) {
          sum += data[i]!;
        }
      }
    } else {
      for (let i = localStart; i <= localEnd; i++) {
        const val = chunk.get(i);
        if (typeof val === "number") {
          sum += val;
        }
      }
    }
  }

  return sum;
}

/**
 * Finds minimum value over a row range utilizing Zone Map pruning.
 */
export function vectorMin(column: Column, startRow: number, endRow: number): number {
  let min = Infinity;
  const startChunkIdx = Math.floor(startRow / CHUNK_SIZE);
  const endChunkIdx = Math.floor(endRow / CHUNK_SIZE);

  for (let cIdx = startChunkIdx; cIdx <= endChunkIdx; cIdx++) {
    const chunk = column.getChunk(cIdx);
    if (!chunk) continue;

    const chunkStartRow = cIdx * CHUNK_SIZE;
    const chunkEndRow = chunkStartRow + CHUNK_SIZE - 1;

    if (chunkStartRow >= startRow && chunkEndRow <= endRow) {
      if (chunk.zoneMap.count > 0 && chunk.zoneMap.min < min) {
        min = chunk.zoneMap.min;
      }
      continue;
    }

    const localStart = Math.max(0, startRow - chunkStartRow);
    const localEnd = Math.min(CHUNK_SIZE - 1, endRow - chunkStartRow);

    for (let i = localStart; i <= localEnd; i++) {
      const val = chunk.get(i);
      if (typeof val === "number" && val < min) {
        min = val;
      }
    }
  }

  return min;
}

/**
 * Finds maximum value over a row range utilizing Zone Map pruning.
 */
export function vectorMax(column: Column, startRow: number, endRow: number): number {
  let max = -Infinity;
  const startChunkIdx = Math.floor(startRow / CHUNK_SIZE);
  const endChunkIdx = Math.floor(endRow / CHUNK_SIZE);

  for (let cIdx = startChunkIdx; cIdx <= endChunkIdx; cIdx++) {
    const chunk = column.getChunk(cIdx);
    if (!chunk) continue;

    const chunkStartRow = cIdx * CHUNK_SIZE;
    const chunkEndRow = chunkStartRow + CHUNK_SIZE - 1;

    if (chunkStartRow >= startRow && chunkEndRow <= endRow) {
      if (chunk.zoneMap.count > 0 && chunk.zoneMap.max > max) {
        max = chunk.zoneMap.max;
      }
      continue;
    }

    const localStart = Math.max(0, startRow - chunkStartRow);
    const localEnd = Math.min(CHUNK_SIZE - 1, endRow - chunkStartRow);

    for (let i = localStart; i <= localEnd; i++) {
      const val = chunk.get(i);
      if (typeof val === "number" && val > max) {
        max = val;
      }
    }
  }

  return max;
}

/**
 * Calculates arithmetic mean over a row range.
 */
export function vectorMean(column: Column, startRow: number, endRow: number): number {
  let count = 0;
  const sum = vectorSum(column, startRow, endRow);

  const startChunkIdx = Math.floor(startRow / CHUNK_SIZE);
  const endChunkIdx = Math.floor(endRow / CHUNK_SIZE);

  for (let cIdx = startChunkIdx; cIdx <= endChunkIdx; cIdx++) {
    const chunk = column.getChunk(cIdx);
    if (!chunk) continue;

    const chunkStartRow = cIdx * CHUNK_SIZE;
    const chunkEndRow = chunkStartRow + CHUNK_SIZE - 1;

    if (chunkStartRow >= startRow && chunkEndRow <= endRow) {
      count += chunk.zoneMap.count;
      continue;
    }

    const localStart = Math.max(0, startRow - chunkStartRow);
    const localEnd = Math.min(CHUNK_SIZE - 1, endRow - chunkStartRow);

    for (let i = localStart; i <= localEnd; i++) {
      if (!chunk.nullMask.isNull(i) && typeof chunk.get(i) === "number") {
        count++;
      }
    }
  }

  if (count === 0) return 0;
  return sum / count;
}
