/**
 * CLI eval command for one-shot formula evaluation from shell arguments or stdin.
 */

import { TrellisEngine } from "@trellis/engine";
import { CellValue, TMatrix, TrellisError, coerceToString } from "@trellis/core";

export interface EvalOptions {
  formula: string;
  sheetName?: string;
  json?: boolean;
  time?: boolean;
}

export interface EvalCommandResult {
  value: CellValue;
  durationMs: number;
  formattedOutput: string;
}

export function runEvalCommand(options: EvalOptions, engine?: TrellisEngine): EvalCommandResult {
  const eng = engine || new TrellisEngine();
  const sheet = options.sheetName || eng.workbook.activeSheet.name;

  const t0 = performance.now();
  const value = eng.evaluateFormula(sheet, options.formula);
  const durationMs = Math.round((performance.now() - t0) * 100) / 100;

  let formattedOutput = "";

  if (options.json) {
    if (value instanceof TMatrix) {
      formattedOutput = JSON.stringify({ result: value.toArray(), durationMs });
    } else if (value instanceof TrellisError) {
      formattedOutput = JSON.stringify({ error: value.code, message: value.message, durationMs });
    } else {
      formattedOutput = JSON.stringify({ result: value, durationMs });
    }
  } else {
    if (value instanceof TMatrix) {
      const arr = value.toArray();
      formattedOutput = arr.map((row) => row.map(coerceToString).join("\t")).join("\n");
    } else if (value instanceof TrellisError) {
      formattedOutput = `\x1b[31m${value.code}\x1b[0m: ${value.message}`;
    } else {
      formattedOutput = coerceToString(value);
    }

    if (options.time) {
      formattedOutput += `\n\x1b[90m(evaluated in ${durationMs}ms)\x1b[0m`;
    }
  }

  return {
    value,
    durationMs,
    formattedOutput
  };
}
