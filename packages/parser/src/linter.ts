/**
 * Formula static analyzer, dependency extractor, and diagnostic linter.
 */

import { ASTNode, walkAST } from "./ast.js";
import { CellCoord, RangeCoord } from "@trellis/core";

export interface FormulaDependencies {
  readonly cells: CellCoord[];
  readonly ranges: RangeCoord[];
  readonly spillRoots: CellCoord[];
  readonly functionNames: string[];
  readonly variables: string[];
  readonly isVolatile: boolean;
}

export interface LintDiagnostic {
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
  readonly start?: number;
  readonly end?: number;
}

const VOLATILE_FUNCTIONS = new Set(["NOW", "TODAY", "RAND", "RANDARRAY", "RANDBETWEEN"]);

/**
 * Extracts all cell, range, and spill dependencies from a formula AST.
 */
export function extractDependencies(ast: ASTNode): FormulaDependencies {
  const cells: CellCoord[] = [];
  const ranges: RangeCoord[] = [];
  const spillRoots: CellCoord[] = [];
  const functionNames: Set<string> = new Set();
  const variables: Set<string> = new Set();
  let isVolatile = false;

  walkAST(ast, (node) => {
    switch (node.type) {
      case "Cell":
        cells.push(node.coord);
        break;
      case "Range":
        ranges.push(node.range);
        break;
      case "SpillRef":
        spillRoots.push(node.root);
        break;
      case "FunctionCall":
        functionNames.add(node.name);
        if (VOLATILE_FUNCTIONS.has(node.name)) {
          isVolatile = true;
        }
        break;
      case "Variable":
        variables.add(node.name);
        break;
    }
  });

  return {
    cells,
    ranges,
    spillRoots,
    functionNames: Array.from(functionNames),
    variables: Array.from(variables),
    isVolatile
  };
}

/**
 * Runs static linting checks against an AST tree.
 */
export function lintFormula(ast: ASTNode): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];

  walkAST(ast, (node) => {
    // Check for unused LET bindings
    if (node.type === "Let") {
      const declaredMap = new Map<string, string>();
      for (const b of node.bindings) {
        declaredMap.set(b.name.toUpperCase(), b.name);
      }
      const usedNames = new Set<string>();

      // Check occurrences in body and subsequent bindings
      for (const b of node.bindings) {
        walkAST(b.expr, (child) => {
          if (child.type === "Variable") usedNames.add(child.name.toUpperCase());
        });
      }
      walkAST(node.body, (child) => {
        if (child.type === "Variable") usedNames.add(child.name.toUpperCase());
      });

      for (const [upperKey, originalName] of declaredMap.entries()) {
        if (!usedNames.has(upperKey)) {
          diagnostics.push({
            severity: "warning",
            message: `Declared variable '${originalName}' in LET is never referenced`,
            start: node.start,
            end: node.end
          });
        }
      }
    }

    // Check for inverted ranges (e.g. B5:A1)
    if (node.type === "Range") {
      if (node.range.startRow > node.range.endRow || node.range.startCol > node.range.endCol) {
        diagnostics.push({
          severity: "info",
          message: `Inverted range coordinate: ${node.raw}`,
          start: node.start,
          end: node.end
        });
      }
    }
  });

  return diagnostics;
}
