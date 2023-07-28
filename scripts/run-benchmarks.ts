import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { runAllBenchmarks, formatBenchmarkTable } from "../benchmarks/framework.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const benchmarksDir = path.resolve(__dirname, "../benchmarks");

async function main(): Promise<void> {
  const files = fs.readdirSync(benchmarksDir).filter((f) => f.endsWith(".bench.ts"));
  files.sort();

  for (const file of files) {
    const fullPath = path.join(benchmarksDir, file);
    await import(fullPath);
  }

  const results = await runAllBenchmarks();
  console.log(formatBenchmarkTable(results));
}

main().catch((err) => {
  console.error("Benchmark runner error:", err);
  process.exit(1);
});
