#!/usr/bin/env node

/**
 * Trellis CLI executable entrypoint.
 */

import * as fs from "node:fs";
import { runEvalCommand } from "./commands/eval.js";
import { runConvertCommand } from "./commands/convert.js";
import { runAuditCommand } from "./commands/audit.js";
import { runBenchCommand } from "./commands/bench.js";
import { TrellisREPL } from "./repl.js";
import { TrellisServer } from "@trellis/server";
import { TrellisEngine } from "@trellis/engine";
import { BinaryCodec, JsonCodec, CsvCodec, Workbook } from "@trellis/storage";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  if (!command || command === "repl") {
    const repl = new TrellisREPL();
    repl.start();
    return;
  }

  if (command === "--version" || command === "-v") {
    console.log("trellis v1.0.0");
    return;
  }

  if (command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return;
  }

  if (command === "eval") {
    const formula = args[1];
    if (!formula) {
      console.error("Error: Missing formula argument for eval command");
      console.error("Usage: trellis eval \"<formula>\" [--json] [--time]");
      process.exit(1);
    }

    const isJson = args.includes("--json");
    const isTime = args.includes("--time");

    const res = runEvalCommand({ formula, json: isJson, time: isTime });
    console.log(res.formattedOutput);
    return;
  }

  if (command === "convert") {
    const inputPath = args[1];
    const outputPath = args[2];
    if (!inputPath || !outputPath) {
      console.error("Error: Missing input or output path for convert command");
      console.error("Usage: trellis convert <input> <output>");
      process.exit(1);
    }

    try {
      const res = runConvertCommand({ inputPath, outputPath });
      console.log(res.message);
    } catch (err) {
      console.error(`Convert failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
    return;
  }

  if (command === "audit") {
    const filepath = args[1];
    let engine: TrellisEngine;

    if (filepath) {
      if (!fs.existsSync(filepath)) {
        console.error(`Error: File not found: ${filepath}`);
        process.exit(1);
      }
      let wb: Workbook;
      if (filepath.endsWith(".trellis")) {
        const bytes = fs.readFileSync(filepath);
        wb = BinaryCodec.deserialize(new Uint8Array(bytes));
      } else if (filepath.endsWith(".json")) {
        wb = JsonCodec.deserialize(fs.readFileSync(filepath, "utf8"));
      } else {
        wb = new Workbook("Sheet1");
        CsvCodec.deserialize(fs.readFileSync(filepath, "utf8"), wb.activeSheet);
      }
      engine = new TrellisEngine(wb);
    } else {
      engine = new TrellisEngine();
    }

    const report = runAuditCommand(engine);
    console.log(report.formattedSummary);
    return;
  }

  if (command === "bench") {
    const report = runBenchCommand();
    console.log(report.formattedSummary);
    return;
  }

  if (command === "serve") {
    let port = 8080;
    const portIdx = args.indexOf("--port");
    if (portIdx !== -1 && args[portIdx + 1]) {
      port = parseInt(args[portIdx + 1]!, 10);
    }

    const server = new TrellisServer();
    const actualPort = await server.start({ port });
    console.log(`\x1b[32mTrellis Collaboration Server active on http://127.0.0.1:${actualPort}\x1b[0m`);
    console.log(`WebSocket endpoint: ws://127.0.0.1:${actualPort}?sessionId=default`);
    return;
  }

  console.error(`Unknown command: '${command}'`);
  printHelp();
  process.exit(1);
}

function printHelp(): void {
  console.log(`
\x1b[1m\x1b[35mTrellis\x1b[0m - High-Throughput Reactive Calculation Engine & Collaboration Kernel

Usage:
  trellis [command] [options]

Commands:
  trellis                       Start interactive terminal REPL
  trellis eval "<formula>"      Evaluate one-shot formula expression
  trellis convert <in> <out>    Convert files across .csv, .json, and .trellis formats
  trellis audit [file]          Inspect formula graph for cycles and static diagnostics
  trellis bench                 Execute calculation throughput and columnar benchmarks
  trellis serve [--port 8080]   Start HTTP & WebSocket real-time collaboration server

Options:
  --json                        Format eval output as structured JSON
  --time                        Include evaluation execution duration in output
  -v, --version                 Print Trellis version
  -h, --help                    Show this help message
`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
