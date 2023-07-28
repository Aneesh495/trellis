/**
 * High-precision microbenchmarking harness with latency percentile analytics.
 */

export interface BenchmarkOptions {
  warmupIterations?: number;
  measurementIterations?: number;
  minDurationMs?: number;
}

export interface BenchmarkResult {
  name: string;
  operationsPerSecond: number;
  meanLatencyMs: number;
  p50LatencyMs: number;
  p90LatencyMs: number;
  p99LatencyMs: number;
  totalIterations: number;
  totalDurationMs: number;
}

export type BenchmarkFunction = () => void | Promise<void>;

interface BenchmarkRegistration {
  name: string;
  fn: BenchmarkFunction;
  options: BenchmarkOptions;
}

const registeredBenchmarks: BenchmarkRegistration[] = [];

export function benchmark(
  name: string,
  fn: BenchmarkFunction,
  options: BenchmarkOptions = {}
): void {
  registeredBenchmarks.push({ name, fn, options });
}

export async function runAllBenchmarks(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  for (const reg of registeredBenchmarks) {
    const warmup = reg.options.warmupIterations ?? 100;
    const minIters = reg.options.measurementIterations ?? 1000;
    const minDuration = reg.options.minDurationMs ?? 200;

    // Warmup phase for V8 JIT optimization
    for (let i = 0; i < warmup; i++) {
      const p = reg.fn();
      if (p instanceof Promise) await p;
    }

    // Measurement phase
    const latencies: number[] = [];
    const startTime = performance.now();
    let elapsed = 0;
    let iterations = 0;

    while (iterations < minIters || elapsed < minDuration) {
      const t0 = performance.now();
      const p = reg.fn();
      if (p instanceof Promise) await p;
      const t1 = performance.now();

      latencies.push(t1 - t0);
      iterations++;
      elapsed = performance.now() - startTime;
    }

    latencies.sort((a, b) => a - b);

    const totalDurationMs = elapsed;
    const operationsPerSecond = (iterations / (totalDurationMs / 1000));
    const sum = latencies.reduce((acc, v) => acc + v, 0);
    const meanLatencyMs = sum / latencies.length;
    const p50LatencyMs = latencies[Math.floor(latencies.length * 0.50)]!;
    const p90LatencyMs = latencies[Math.floor(latencies.length * 0.90)]!;
    const p99LatencyMs = latencies[Math.floor(latencies.length * 0.99)]!;

    results.push({
      name: reg.name,
      operationsPerSecond,
      meanLatencyMs,
      p50LatencyMs,
      p90LatencyMs,
      p99LatencyMs,
      totalIterations: iterations,
      totalDurationMs
    });
  }

  return results;
}

export function formatBenchmarkTable(results: BenchmarkResult[]): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("=========================================================================================================");
  lines.push("                                      TRELLIS PERFORMANCE BENCHMARKS                                     ");
  lines.push("=========================================================================================================");
  lines.push(
    "Benchmark".padEnd(42) +
    "Ops/Sec".padStart(14) +
    "Mean (ms)".padStart(12) +
    "p50 (ms)".padStart(12) +
    "p90 (ms)".padStart(12) +
    "p99 (ms)".padStart(12)
  );
  lines.push("---------------------------------------------------------------------------------------------------------");

  for (const r of results) {
    const ops = r.operationsPerSecond >= 1000000
      ? (r.operationsPerSecond / 1000000).toFixed(2) + "M"
      : r.operationsPerSecond >= 1000
        ? (r.operationsPerSecond / 1000).toFixed(1) + "k"
        : r.operationsPerSecond.toFixed(0);

    lines.push(
      r.name.padEnd(42) +
      ops.padStart(14) +
      r.meanLatencyMs.toFixed(4).padStart(12) +
      r.p50LatencyMs.toFixed(4).padStart(12) +
      r.p90LatencyMs.toFixed(4).padStart(12) +
      r.p99LatencyMs.toFixed(4).padStart(12)
    );
  }
  lines.push("=========================================================================================================");
  lines.push("");
  return lines.join("\n");
}
