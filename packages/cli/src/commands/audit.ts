/**
 * CLI audit command analyzing model integrity, circular references, and formula diagnostics.
 */

import { TrellisEngine } from "@trellis/engine";
import { formatCellRef } from "@trellis/core";
import { lintFormula, LintDiagnostic } from "@trellis/parser";

export interface CellAuditDiagnostic {
  readonly cell: string;
  readonly formula: string;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
}

export interface AuditReport {
  readonly totalCells: number;
  readonly formulaCount: number;
  readonly volatileCount: number;
  readonly cycleCount: number;
  readonly cycles: string[][];
  readonly diagnostics: CellAuditDiagnostic[];
  readonly formattedSummary: string;
}

export function runAuditCommand(engine: TrellisEngine): AuditReport {
  let totalCells = 0;
  let formulaCount = 0;
  const diagnostics: CellAuditDiagnostic[] = [];

  for (const sheet of engine.workbook.sheets) {
    for (const cell of sheet.getAllCells()) {
      totalCells++;
      if (cell.formula) {
        formulaCount++;
        const cellRef = formatCellRef(cell.coord);

        if (cell.ast) {
          const lints: LintDiagnostic[] = lintFormula(cell.ast);
          for (const l of lints) {
            diagnostics.push({
              cell: cellRef,
              formula: cell.formula,
              severity: l.severity,
              message: l.message
            });
          }
        }
      }
    }
  }

  const detectedCycles = engine.dag.detectCycles();
  const cycles = detectedCycles.map((c) => c.cyclePath);
  const volatileCount = engine.dag.getVolatileCoords().length;

  const lines: string[] = [];
  lines.push(`\x1b[1m=== Trellis Model Integrity Audit ===\x1b[0m`);
  lines.push(`Total Cells:     ${totalCells}`);
  lines.push(`Formula Cells:   ${formulaCount}`);
  lines.push(`Volatile Cells:  ${volatileCount}`);
  lines.push(`Detected Cycles: ${cycles.length}`);

  if (cycles.length > 0) {
    lines.push(`\n\x1b[31m[CIRCULAR DEPENDENCIES DETECTED]\x1b[0m`);
    for (let i = 0; i < cycles.length; i++) {
      lines.push(`  ${i + 1}. ${cycles[i]!.join(" -> ")}`);
    }
  }

  if (diagnostics.length > 0) {
    lines.push(`\n\x1b[33m[STATIC LINT DIAGNOSTICS]\x1b[0m`);
    for (const d of diagnostics) {
      lines.push(`  ${d.cell}: ${d.message} (${d.formula})`);
    }
  }

  if (cycles.length === 0 && diagnostics.length === 0) {
    lines.push(`\n\x1b[32mPASS: Model is clean with zero detected cycles or static warnings.\x1b[0m`);
  }

  return {
    totalCells,
    formulaCount,
    volatileCount,
    cycleCount: cycles.length,
    cycles,
    diagnostics,
    formattedSummary: lines.join("\n")
  };
}
