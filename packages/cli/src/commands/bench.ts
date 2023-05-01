/**
 * High-throughput microbenchmark runner for VM bytecode execution, DAG propagation, and columnar aggregation.
 */

import { TrellisEngine } from "@trellis/engine";
import { Column, vectorSum } from "@trellis/columnar";

export interface BenchmarkResult {
  readonly name: string;
  readonly iterations: number;
  readonly durationMs: number;
  readonly opsPerSec: number;
}

export interface BenchmarkReport {
  readonly results: BenchmarkResult[];
  readonly formattedSummary: string;
}

export function runBenchCommand(iterations = 20_000): BenchmarkReport {
  const results: BenchmarkResult[] = [];

  // 1. VM Arithmetic Evaluation Throughput
  {
    const engine = new TrellisEngine();
    engine.setCell("Sheet1", "A1", "10");
    engine.setCell("Sheet1", "B1", "20");

    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) {
      engine.evaluateFormula("Sheet1", "=A1 * 3 + B1 * 4");
    }
    const durationMs = Math.max(1, performance.now() - t0);
    const opsPerSec = Math.round((iterations / (durationMs / 1000)));

    results.push({
      name: "VM Arithmetic Evaluation",
      iterations,
      durationMs: Math.round(durationMs * 100) / 100,
      opsPerSec
    });
  }

  // 2. Incremental DAG Recalculation Chain
  {
    const engine = new TrellisEngine();
    const chainLength = 200;
    engine.setCell("Sheet1", "A1", "1");
    for (let i = 2; i <= chainLength; i++) {
      engine.setCell("Sheet1", `A${i}`, `=A${i - 1} + 1`);
    }

    const chainIterations = 1_000;
    const t0 = performance.now();
    for (let i = 0; i < chainIterations; i++) {
      engine.setCell("Sheet1", "A1", String(i));
    }
    const durationMs = Math.max(1, performance.now() - t0);
    const opsPerSec = Math.round((chainIterations * chainLength) / (durationMs / 1000));

    results.push({
      name: "DAG Chain Recalculation",
      iterations: chainIterations * chainLength,
      durationMs: Math.round(durationMs * 100) / 100,
      opsPerSec
    });
  }

  // 3. Vectorized Columnar Aggregation
  {
    const col = new Column(0);
    for (let i = 0; i < 1024; i++) {
      col.set(i, i * 1.5);
    }

    const colIterations = 50_000;
    const t0 = performance.now();
    for (let i = 0; i < colIterations; i++) {
      vectorSum(col, 0, 1023);
    }
    const durationMs = Math.max(1, performance.now() - t0);
    const opsPerSec = Math.round((colIterations * 1024) / (durationMs / 1000));

    results.push({
      name: "Columnar Vectorized Sum",
      iterations: colIterations * 1024,
      durationMs: Math.round(durationMs * 100) / 100,
      opsPerSec
    });
  }

  const lines: string[] = [];
  lines.push(`\x1b[1m=== Trellis Performance Benchmarks ===\x1b[0m`);
  for (const r of results) {
    const opsFormatted = r.opsPerSec.toLocaleString();
    lines.push(`  ${r.name.padEnd(28)}: ${opsFormatted.padStart(12)} ops/sec (${r.durationMs}ms)`);
  }

  return {
    results,
    formattedSummary: lines.join("\n")
  };
}
