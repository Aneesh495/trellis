import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { runAllTests } from "./framework.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let filter: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--filter" && i + 1 < args.length) {
      filter = args[i + 1];
      i++;
    } else if (args[i]?.startsWith("--filter=")) {
      filter = args[i].substring(9);
    } else if (args[i] === "--unit") {
      filter = "unit";
    } else if (args[i] === "--integration") {
      filter = "integration";
    } else if (args[i] === "--fuzz") {
      filter = "fuzz";
    }
  }

  const testFiles: string[] = [];
  function discoverTestFiles(dir: string): void {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        discoverTestFiles(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.js"))) {
        testFiles.push(fullPath);
      }
    }
  }

  discoverTestFiles(__dirname);
  testFiles.sort();

  if (testFiles.length === 0) {
    console.log("No test files found in tests directory.");
    return;
  }

  console.log(`\x1b[1m\x1b[35m=== Trellis Verification Harness ===\x1b[0m`);
  console.log(`Discovered ${testFiles.length} test suites.`);

  for (const testFile of testFiles) {
    // Dynamic import to register all describe/it blocks
    await import(`file://${testFile}`);
  }

  const stats = await runAllTests(filter);

  console.log(`\n\x1b[1m========================================\x1b[0m`);
  console.log(`Total tests:  ${stats.total}`);
  console.log(`Passed:       \x1b[32m${stats.passed}\x1b[0m`);
  console.log(`Failed:       ${stats.failed > 0 ? `\x1b[31m${stats.failed}\x1b[0m` : `\x1b[32m0\x1b[0m`}`);
  console.log(`Duration:     ${stats.durationMs} ms`);
  console.log(`\x1b[1m========================================\x1b[0m`);

  if (stats.failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test runner encountered fatal error:", err);
  process.exit(1);
});
