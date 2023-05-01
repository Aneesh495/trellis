/**
 * Interactive terminal REPL with live formula evaluation, table preview, and inspection commands.
 */

import * as readline from "node:readline";
import * as fs from "node:fs";
import { TrellisEngine } from "@trellis/engine";
import { BinaryCodec, JsonCodec, CsvCodec } from "@trellis/storage";
import { coerceToString, indexToCol } from "@trellis/core";
import { runBenchCommand } from "./commands/bench.js";
import { runAuditCommand } from "./commands/audit.js";

export class TrellisREPL {
  private readonly engine: TrellisEngine;
  private activeSheetName = "Sheet1";

  constructor(engine?: TrellisEngine) {
    this.engine = engine || new TrellisEngine();
  }

  /**
   * Starts the interactive Read-Eval-Print Loop.
   */
  public start(): void {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `\x1b[35mtrellis\x1b[0m [\x1b[36m${this.activeSheetName}\x1b[0m]> `
    });

    console.log(`\x1b[1m\x1b[35mWelcome to Trellis Interactive Calculation Kernel (v1.0.0)\x1b[0m`);
    console.log(`Type any formula (e.g. \x1b[32m=SUM(1, 2, 3)\x1b[0m) or \x1b[33m:help\x1b[0m for commands.\n`);

    rl.prompt();

    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        rl.prompt();
        return;
      }

      if (trimmed.startsWith(":")) {
        const handled = this.handleCommand(trimmed);
        if (!handled) {
          rl.close();
          return;
        }
      } else {
        // Direct formula or cell assignment
        this.handleEvaluation(trimmed);
      }

      rl.setPrompt(`\x1b[35mtrellis\x1b[0m [\x1b[36m${this.activeSheetName}\x1b[0m]> `);
      rl.prompt();
    });

    rl.on("close", () => {
      console.log("\nExiting Trellis. Goodbye!");
      process.exit(0);
    });
  }

  public handleEvaluation(input: string): string {
    try {
      if (input.includes("=") && input.split("=")[0]?.trim().match(/^[A-Za-z]+[0-9]+$/)) {
        // Assignment like A1 = 50 or A1 = B1 + 10
        const eqIdx = input.indexOf("=");
        const ref = input.slice(0, eqIdx).trim();
        const formulaOrVal = input.slice(eqIdx + 1).trim();
        const raw = formulaOrVal.startsWith("=") ? formulaOrVal : `=${formulaOrVal}`;

        this.engine.setCell(this.activeSheetName, ref, raw);
        const val = this.engine.getCellValue(this.activeSheetName, ref);
        const out = `\x1b[36m${ref.toUpperCase()}\x1b[0m \x1b[90m:=\x1b[0m \x1b[32m${coerceToString(val)}\x1b[0m`;
        console.log(out);
        return out;
      } else {
        // Ephemeral formula evaluation
        const formula = input.startsWith("=") ? input : `=${input}`;
        const val = this.engine.evaluateFormula(this.activeSheetName, formula);
        const out = `\x1b[32m${coerceToString(val)}\x1b[0m`;
        console.log(out);
        return out;
      }
    } catch (err) {
      const errOut = `\x1b[31mError:\x1b[0m ${err instanceof Error ? err.message : String(err)}`;
      console.log(errOut);
      return errOut;
    }
  }

  private handleCommand(cmdLine: string): boolean {
    const parts = cmdLine.slice(1).trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case "help":
        console.log(`
Available REPL Commands:
  =EXPR             Evaluate arbitrary formula expression (e.g. =PMT(0.05/12, 60, 25000))
  <A1> = <EXPR>     Assign value or formula to cell (e.g. A1 = 100, B1 = A1 * 2)
  :print [sheet]    Display visual ASCII table grid of current sheet
  :sheet <name>     Switch active sheet context
  :load <file>      Load .trellis, .json, or .csv workbook file
  :save <file>      Export workbook to .trellis, .json, or .csv
  :audit            Run integrity audit for circular dependencies and linter diagnostics
  :bench            Execute calculation engine throughput benchmarks
  :clear            Clear current sheet
  :exit / :quit     Exit REPL session
`);
        break;

      case "sheet":
        if (args[0]) {
          this.activeSheetName = args[0];
          console.log(`Active sheet switched to '${this.activeSheetName}'`);
        }
        break;

      case "print":
      case "view":
        this.printAsciiGrid();
        break;

      case "audit": {
        const report = runAuditCommand(this.engine);
        console.log(report.formattedSummary);
        break;
      }

      case "bench": {
        console.log("Running benchmarks...");
        const report = runBenchCommand();
        console.log(report.formattedSummary);
        break;
      }

      case "save":
        if (args[0]) {
          this.saveWorkbook(args[0]);
        } else {
          console.log("Usage: :save <filename>");
        }
        break;

      case "load":
        if (args[0]) {
          this.loadWorkbook(args[0]);
        } else {
          console.log("Usage: :load <filename>");
        }
        break;

      case "clear":
        this.engine.workbook.getSheet(this.activeSheetName)?.clear();
        console.log(`Sheet '${this.activeSheetName}' cleared.`);
        break;

      case "exit":
      case "quit":
      case "q":
        return false;

      default:
        console.log(`Unknown command :${cmd}. Type :help for assistance.`);
    }

    return true;
  }

  private printAsciiGrid(): void {
    const sheet = this.engine.workbook.getSheet(this.activeSheetName);
    if (!sheet) {
      console.log(`Sheet '${this.activeSheetName}' does not exist.`);
      return;
    }

    const { maxRow, maxCol } = sheet.getBounds();
    const rows = Math.min(20, Math.max(5, maxRow + 1));
    const cols = Math.min(10, Math.max(4, maxCol + 1));

    // Calculate column widths
    const colWidths: number[] = [];
    for (let c = 0; c < cols; c++) {
      let w = 8;
      for (let r = 0; r < rows; r++) {
        const val = this.engine.getCellValue(this.activeSheetName, { row: r, col: c });
        const len = coerceToString(val).length;
        if (len + 2 > w) w = Math.min(24, len + 2);
      }
      colWidths.push(w);
    }

    // Header row
    const headerTokens = ["    "];
    for (let c = 0; c < cols; c++) {
      headerTokens.push(indexToCol(c).padStart(colWidths[c]!));
    }
    console.log(headerTokens.join(" | "));

    const sep = "-".repeat(headerTokens.join(" | ").length);
    console.log(sep);

    // Data rows
    for (let r = 0; r < rows; r++) {
      const rowTokens = [String(r + 1).padStart(4)];
      for (let c = 0; c < cols; c++) {
        const val = this.engine.getCellValue(this.activeSheetName, { row: r, col: c });
        const text = val === null || val === undefined ? "" : coerceToString(val);
        rowTokens.push(text.padStart(colWidths[c]!));
      }
      console.log(rowTokens.join(" | "));
    }
    console.log("");
  }

  private saveWorkbook(filepath: string): void {
    try {
      if (filepath.endsWith(".trellis")) {
        const bytes = BinaryCodec.serialize(this.engine.workbook);
        fs.writeFileSync(filepath, bytes);
      } else if (filepath.endsWith(".json")) {
        const json = JsonCodec.serialize(this.engine.workbook, true);
        fs.writeFileSync(filepath, json, "utf8");
      } else {
        const sheet = this.engine.workbook.getSheet(this.activeSheetName);
        if (sheet) {
          const csv = CsvCodec.serialize(sheet);
          fs.writeFileSync(filepath, csv, "utf8");
        }
      }
      console.log(`Saved workbook to ${filepath}`);
    } catch (err) {
      console.log(`Failed to save: ${err}`);
    }
  }

  private loadWorkbook(filepath: string): void {
    try {
      if (filepath.endsWith(".trellis")) {
        const bytes = fs.readFileSync(filepath);
        const wb = BinaryCodec.deserialize(new Uint8Array(bytes));
        this.engine.workbook.clear();
        for (const s of wb.sheets) {
          this.engine.workbook.sheets.push(s);
        }
      } else if (filepath.endsWith(".json")) {
        const json = fs.readFileSync(filepath, "utf8");
        const wb = JsonCodec.deserialize(json);
        this.engine.workbook.clear();
        for (const s of wb.sheets) {
          this.engine.workbook.sheets.push(s);
        }
      }
      this.engine.rebuildDependencyGraph();
      this.engine.recalculate();
      console.log(`Loaded workbook from ${filepath}`);
    } catch (err) {
      console.log(`Failed to load: ${err}`);
    }
  }
}
