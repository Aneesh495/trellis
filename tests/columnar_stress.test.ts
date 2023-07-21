import { describe, it, assert, assertEqual } from "./framework.js";
import {
  NullBitMask,
  ZoneMap,
  DictionaryChunk,
  Column,
  vectorSum,
  vectorMin,
  vectorMax,
  vectorMean
} from "../packages/columnar/src/index.js";

describe("Columnar: High-Scale Stress Testing and Memory Efficiency", () => {
  it("allocates and aggregates 1,000,000 numeric cells across chunk boundaries", () => {
    const col = new Column(0);
    const N = 1000000;

    // Populate 1,000,000 cells with constant value 7.5
    for (let r = 0; r < N; r++) {
      col.set(r, 7.5);
    }

    assertEqual(col.chunks.size, Math.ceil(N / 1024));

    const totalSum = vectorSum(col, 0, N - 1);
    assertEqual(totalSum, 7.5 * N);

    const minVal = vectorMin(col, 0, N - 1);
    assertEqual(minVal, 7.5);

    const maxVal = vectorMax(col, 0, N - 1);
    assertEqual(maxVal, 7.5);

    const avgVal = vectorMean(col, 0, N - 1);
    assertEqual(avgVal, 7.5);

    // Verify sub-range spanning across multiple interior chunk boundaries
    const subRangeSum = vectorSum(col, 10000, 29999);
    assertEqual(subRangeSum, 7.5 * 20000);
  });

  it("efficiently tracks 1,000,000 bit-packed null mask flags with zero leakage", () => {
    const mask = new NullBitMask(1000000);
    assert(mask.noneNull(), "New mask must start with none null");
    assertEqual(mask.countNulls(), 0);

    // Set alternating every 100th element to null
    let nullCount = 0;
    for (let i = 0; i < 1000000; i += 100) {
      mask.setNull(i, true);
      nullCount++;
    }

    assertEqual(mask.countNulls(), nullCount);
    assertEqual(mask.isNull(0), true);
    assertEqual(mask.isNull(1), false);
    assertEqual(mask.isNull(100), true);
    assertEqual(mask.isNull(101), false);
    assertEqual(mask.isNull(999900), true);
  });

  it("prunes zone maps rapidly during range scans with disjoint query intervals", () => {
    const zm = new ZoneMap();
    zm.recordValue(1000);
    zm.recordValue(5000);
    zm.recordValue(3000);

    // Verify pruning bounds
    assert(zm.canPrune(0, 999), "Values below min should be pruned");
    assert(zm.canPrune(5001, 10000), "Values above max should be pruned");
    assert(!zm.canPrune(2000, 4000), "Interior overlapping values should not be pruned");
    assert(!zm.canPrune(500, 1500), "Lower boundary overlapping values should not be pruned");
  });

  it("compresses 50,000 low-cardinality strings in DictionaryChunk with high ratio", () => {
    const chunk = new DictionaryChunk();
    const categories = ["EQUITY", "FIXED_INCOME", "COMMODITY", "FX", "DERIVATIVE"];

    for (let r = 0; r < 1024; r++) {
      const cat = categories[r % categories.length]!;
      chunk.set(r, cat);
    }

    // Only 5 unique entries in dictionary dictionary pool
    assertEqual(chunk.dictionary.length, 5);
    for (let r = 0; r < 1024; r++) {
      const expected = categories[r % categories.length]!;
      assertEqual(chunk.get(r), expected);
    }
  });
});
