import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, assert, assertEqual } from "./framework.js";
import {
  runEvalCommand,
  runConvertCommand,
  runAuditCommand,
  runBenchCommand,
  TrellisREPL
} from "@trellis/cli";
import { TrellisEngine } from "@trellis/engine";

describe("TrellisCLI: Eval Command", () => {
  it("should evaluate inline formula expressions", () => {
    const res = runEvalCommand({ formula: "=10 * 5 + 2" });
    assertEqual(res.value, 52);
    assertEqual(res.formattedOutput, "52");
  });

  it("should output JSON when requested", () => {
    const res = runEvalCommand({ formula: "=SUM(10, 20)", json: true });
    assertEqual(res.value, 30);
    const parsed = JSON.parse(res.formattedOutput);
    assertEqual(parsed.result, 30);
  });
});

describe("TrellisCLI: Convert Command", () => {
  it("should convert seamlessly between CSV, JSON, and Trellis binary formats", () => {
    const tmpDir = path.join(process.cwd(), "tmp_test_convert");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    const csvPath = path.join(tmpDir, "data.csv");
    const jsonPath = path.join(tmpDir, "data.json");
    const trellisPath = path.join(tmpDir, "data.trellis");

    try {
      fs.writeFileSync(csvPath, "SKU,Price,Qty\nA100,10.5,5\nB200,25.0,2\n");

      // 1. CSV -> JSON
      const res1 = runConvertCommand({ inputPath: csvPath, outputPath: jsonPath });
      assertEqual(res1.success, true);
      assert(fs.existsSync(jsonPath), "JSON file must exist");

      // 2. JSON -> Trellis
      const res2 = runConvertCommand({ inputPath: jsonPath, outputPath: trellisPath });
      assertEqual(res2.success, true);
      assert(fs.existsSync(trellisPath), "Trellis binary file must exist");

      // 3. Verify Trellis binary contains data
      const bytes = fs.readFileSync(trellisPath);
      assert(bytes.length > 20, "Trellis binary must not be empty");
    } finally {
      // Clean up temporary files
      if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
      if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
      if (fs.existsSync(trellisPath)) fs.unlinkSync(trellisPath);
      if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
    }
  });
});

describe("TrellisCLI: Audit Command", () => {
  it("should pass clean models and detect circular dependencies", () => {
    const engineClean = new TrellisEngine();
    engineClean.setCell("Sheet1", "A1", "10");
    engineClean.setCell("Sheet1", "B1", "=A1 * 2");

    const reportClean = runAuditCommand(engineClean);
    assertEqual(reportClean.cycleCount, 0);
    assert(reportClean.formattedSummary.includes("PASS"), "Clean model must report PASS");

    // Circular dependency
    const engineCyclic = new TrellisEngine();
    engineCyclic.setCell("Sheet1", "A1", "=B1 + 1");
    engineCyclic.setCell("Sheet1", "B1", "=A1 + 1");

    const reportCyclic = runAuditCommand(engineCyclic);
    assertEqual(reportCyclic.cycleCount, 1);
    assert(reportCyclic.formattedSummary.includes("CIRCULAR DEPENDENCIES"), "Must report cycles");
  });
});

describe("TrellisCLI: Bench Command", () => {
  it("should execute microbenchmarks and report ops per second", () => {
    const report = runBenchCommand(500);
    assert(report.results.length >= 3, "Should report at least 3 benchmark suites");
    for (const r of report.results) {
      assert(r.opsPerSec > 0, "Ops per sec must be positive");
    }
  });
});

describe("TrellisCLI: Interactive REPL Evaluation", () => {
  it("should evaluate expressions and cell assignments in REPL mode", () => {
    const repl = new TrellisREPL();
    const evalOut = repl.handleEvaluation("=100 + 25");
    assert(evalOut.includes("125"), "Must evaluate formula to 125");

    const assignOut = repl.handleEvaluation("A1 = 50");
    assert(assignOut.includes("A1"), "Must format cell assignment");
  });
});
