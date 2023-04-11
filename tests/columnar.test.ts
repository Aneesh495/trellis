import { describe, it, assert, assertEqual, assertCloseTo } from "./framework.js";
import {
  NullBitMask,
  ZoneMap,
  Float64Chunk,
  DictionaryChunk,
  Column,
  vectorSum,
  vectorMin,
  vectorMax,
  vectorMean
} from "../packages/columnar/src/index.js";

describe("Columnar: NullBitMask", () => {
  it("tracks null/blank states with bitwise operations", () => {
    const mask = new NullBitMask(64);
    assert(mask.noneNull());
    assertEqual(mask.countNulls(), 0);

    mask.setNull(0, true);
    mask.setNull(31, true);
    mask.setNull(32, true);

    assertEqual(mask.isNull(0), true);
    assertEqual(mask.isNull(1), false);
    assertEqual(mask.isNull(31), true);
    assertEqual(mask.isNull(32), true);
    assertEqual(mask.countNulls(), 3);

    mask.setNull(31, false);
    assertEqual(mask.isNull(31), false);
    assertEqual(mask.countNulls(), 2);

    mask.fillAllNull();
    assert(mask.allNull());
    assertEqual(mask.countNulls(), 64);
  });
});

describe("Columnar: ZoneMap", () => {
  it("tracks bounds and prunes non-overlapping search intervals", () => {
    const zm = new ZoneMap();
    zm.recordValue(100);
    zm.recordValue(500);
    zm.recordValue(250);

    assertEqual(zm.min, 100);
    assertEqual(zm.max, 500);
    assertEqual(zm.sum, 850);
    assertEqual(zm.count, 3);

    // [600..700] is outside [100..500], should be pruned
    assert(zm.canPrune(600, 700));
    // [0..50] is outside, should be pruned
    assert(zm.canPrune(0, 50));
    // [200..300] overlaps, cannot be pruned
    assert(!zm.canPrune(200, 300));
  });
});

describe("Columnar: Typed Chunks", () => {
  it("stores numeric data in Float64Chunk with zone maps", () => {
    const chunk = new Float64Chunk();
    chunk.set(0, 42.5);
    chunk.set(100, 1000);

    assertEqual(chunk.get(0), 42.5);
    assertEqual(chunk.get(100), 1000);
    assertEqual(chunk.get(50), null);

    assertEqual(chunk.zoneMap.min, 42.5);
    assertEqual(chunk.zoneMap.max, 1000);
    assertEqual(chunk.zoneMap.count, 2);
    assertEqual(chunk.zoneMap.nullCount, 1022);
  });

  it("compresses low-cardinality strings in DictionaryChunk", () => {
    const chunk = new DictionaryChunk();
    chunk.set(0, "ACTIVE");
    chunk.set(1, "PENDING");
    chunk.set(2, "ACTIVE");
    chunk.set(3, "ACTIVE");

    assertEqual(chunk.get(0), "ACTIVE");
    assertEqual(chunk.get(1), "PENDING");
    assertEqual(chunk.get(2), "ACTIVE");

    // Dictionary should have exactly 2 distinct entries
    assertEqual(chunk.dictionary.length, 2);
  });
});

describe("Columnar: Column and Vectorized Aggregators", () => {
  it("aggregates large columnar ranges across chunks utilizing zone maps", () => {
    const col = new Column(0);
    const N = 4096; // 4 full 1024-cell chunks

    let expectedSum = 0;
    for (let r = 0; r < N; r++) {
      const val = (r % 100) + 1;
      col.set(r, val);
      expectedSum += val;
    }

    assertEqual(col.chunks.size, 4);

    const sum = vectorSum(col, 0, N - 1);
    assertEqual(sum, expectedSum);

    const min = vectorMin(col, 0, N - 1);
    assertEqual(min, 1);

    const max = vectorMax(col, 0, N - 1);
    assertEqual(max, 100);

    const mean = vectorMean(col, 0, N - 1);
    assertCloseTo(mean, expectedSum / N, 1e-5);

    // Partial range across chunk boundary
    const partialSum = vectorSum(col, 500, 1500);
    let expectedPartial = 0;
    for (let r = 500; r <= 1500; r++) {
      expectedPartial += (r % 100) + 1;
    }
    assertEqual(partialSum, expectedPartial);
  });
});
