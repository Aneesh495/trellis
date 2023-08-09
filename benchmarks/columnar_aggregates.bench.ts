import { benchmark } from "./framework.js";
import {
  Column,
  vectorSum,
  vectorMax,
  NullBitMask,
  DictionaryChunk
} from "../packages/columnar/src/index.js";

// 1. Column with 50,000 numeric rows across chunks
const col = new Column(0);
const N = 50000;
for (let r = 0; r < N; r++) {
  col.set(r, (r % 1000) + 1);
}

// 2. Large NullBitMask with 100,000 entries
const mask = new NullBitMask(100000);
for (let i = 0; i < 100000; i += 50) {
  mask.setNull(i, true);
}

// 3. DictionaryChunk populated with repetitive strings
const dictChunk = new DictionaryChunk();
const symbols = ["AAPL", "GOOGL", "MSFT", "AMZN", "NVDA", "META", "TSLA"];
for (let i = 0; i < 1024; i++) {
  dictChunk.set(i, symbols[i % symbols.length]!);
}

benchmark("Columnar: Vectorized SUM across 50,000 Cells", () => {
  vectorSum(col, 0, N - 1);
}, { warmupIterations: 100, minDurationMs: 150 });

benchmark("Columnar: Vectorized MAX with Zone Map Pruning", () => {
  vectorMax(col, 0, N - 1);
}, { warmupIterations: 100, minDurationMs: 150 });

benchmark("Columnar: Bit-Packed Null Mask Scanning (100k Bits)", () => {
  mask.countNulls();
}, { warmupIterations: 500, minDurationMs: 150 });

benchmark("Columnar: Dictionary String Decoding (1024 Rows)", () => {
  for (let i = 0; i < 1024; i++) {
    dictChunk.get(i);
  }
}, { warmupIterations: 500, minDurationMs: 150 });
