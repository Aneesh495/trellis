/**
 * Master calculation engine unifying AST parsing, bytecode compilation, DAG dependency
 * tracking, dynamic array allocation, and workbook storage.
 */

import {
  CellCoord,
  RangeCoord,
  CellValue,
  TMatrix,
  TrellisError,
  TypedEventEmitter,
  parseCellRef,
  parseRangeRef
} from "@trellis/core";
import { Parser, ASTNode, extractDependencies } from "@trellis/parser";
import { BytecodeChunk, BytecodeCompiler, VirtualMachine } from "@trellis/runtime";
import { DependencyDAG, keyToCoord } from "@trellis/graph";
import { SpillManager } from "@trellis/spill";
import { Workbook, Sheet } from "@trellis/storage";
import { WorkbookEvaluationContext } from "./eval_context.js";
import { TransactionBatch } from "./transaction.js";

export interface RecalcStats {
  readonly evaluatedCount: number;
  readonly durationMs: number;
  readonly waveCount: number;
}

export class TrellisEngine {
  public readonly workbook: Workbook;
  public readonly dag: DependencyDAG = new DependencyDAG();
  public readonly spillManager: SpillManager = new SpillManager();
  public readonly events: TypedEventEmitter = new TypedEventEmitter();

  private readonly bytecodeCache: Map<string, BytecodeChunk> = new Map();
  private isBatching = false;
  private pendingBatchRoots: CellCoord[] = [];

  constructor(workbook?: Workbook) {
    this.workbook = workbook || new Workbook("Sheet1");
    this.rebuildDependencyGraph();
  }

  /**
   * Scans all sheets in the workbook to initialize DAG dependencies for existing formulas.
   */
  public rebuildDependencyGraph(): void {
    this.dag.clear();
    for (const sheet of this.workbook.sheets) {
      for (const cell of sheet.getAllCells()) {
        if (cell.formula) {
          this.registerFormulaDependencies(cell.coord, cell.formula);
        }
      }
    }
  }

  /**
   * Sets the raw input or formula for a cell, triggering reactive recalculation.
   */
  public setCell(sheetName: string, ref: string | CellCoord, rawInput: string): void {
    const coord = this.normalizeCoord(sheetName, ref);
    const targetSheet = this.getOrCreateSheet(coord.sheet!);

    const cell = targetSheet.getOrCreateCell(coord.row, coord.col);
    const trimmed = rawInput.trim();

    const blockedRoots = this.spillManager.getBlockedSpillRootsAt(coord);

    if (trimmed.startsWith("=") || trimmed.startsWith("+")) {
      const formula = trimmed.startsWith("+") ? `=${trimmed.slice(1)}` : trimmed;
      cell.setInput(formula);
      this.registerFormulaDependencies(coord, formula);
    } else {
      cell.setInput(rawInput);
      this.dag.clearPrecedents(coord);
      this.spillManager.removeSpill(coord);
    }

    this.events.emit("cell:change", {
      coord,
      newValue: cell.value,
      formula: cell.formula
    });

    const recalcRoots = [coord, ...blockedRoots];
    if (this.isBatching) {
      this.pendingBatchRoots.push(...recalcRoots);
    } else {
      this.recalculate(recalcRoots);
    }
  }

  /**
   * Clears cell contents and removes it from dependency graphs and spills.
   */
  public clearCell(sheetName: string, ref: string | CellCoord): void {
    const coord = this.normalizeCoord(sheetName, ref);
    const targetSheet = this.workbook.getSheet(coord.sheet!);
    if (!targetSheet) return;

    const blockedRoots = this.spillManager.getBlockedSpillRootsAt(coord);

    targetSheet.removeCell(coord.row, coord.col);
    this.dag.clearPrecedents(coord);
    this.spillManager.removeSpill(coord);

    this.events.emit("cell:change", {
      coord,
      newValue: null,
      formula: undefined
    });

    const recalcRoots = [coord, ...blockedRoots];
    if (this.isBatching) {
      this.pendingBatchRoots.push(...recalcRoots);
    } else {
      this.recalculate(recalcRoots);
    }
  }

  /**
   * Retrieves the current evaluated value of a cell.
   */
  public getCellValue(sheetName: string, ref: string | CellCoord): CellValue {
    const coord = this.normalizeCoord(sheetName, ref);

    // 1. Check if coordinate is inside an active spill
    if (this.spillManager.isGhostCell(coord)) {
      return this.spillManager.getSpillValue(coord);
    }

    const targetSheet = this.workbook.getSheet(coord.sheet!);
    if (!targetSheet) {
      return TrellisError.refError(`Sheet '${coord.sheet}' does not exist`);
    }

    const cell = targetSheet.getCell(coord.row, coord.col);
    if (!cell) {
      return null;
    }

    return cell.value;
  }

  /**
   * Retrieves the raw input text of a cell.
   */
  public getCellRaw(sheetName: string, ref: string | CellCoord): string {
    const coord = this.normalizeCoord(sheetName, ref);
    const targetSheet = this.workbook.getSheet(coord.sheet!);
    if (!targetSheet) return "";
    const cell = targetSheet.getCell(coord.row, coord.col);
    return cell ? cell.raw : "";
  }

  /**
   * Retrieves formula string if the cell contains a formula.
   */
  public getCellFormula(sheetName: string, ref: string | CellCoord): string | undefined {
    const coord = this.normalizeCoord(sheetName, ref);
    const targetSheet = this.workbook.getSheet(coord.sheet!);
    if (!targetSheet) return undefined;
    const cell = targetSheet.getCell(coord.row, coord.col);
    return cell ? cell.formula : undefined;
  }

  /**
   * Evaluates an ephemeral formula string within the context of a sheet.
   */
  public evaluateFormula(sheetName: string, formulaText: string): CellValue {
    const trimmed = formulaText.trim();
    const formula = trimmed.startsWith("=") ? trimmed : `=${trimmed}`;
    const ast = Parser.parse(formula);
    const chunk = BytecodeCompiler.compile(ast);
    const evalCtx = new WorkbookEvaluationContext(
      this.workbook,
      this.spillManager,
      undefined,
      sheetName
    );
    return VirtualMachine.evaluate(chunk, evalCtx);
  }

  /**
   * Registers a named range in the workbook.
   */
  public setNamedRange(name: string, rangeOrRef: string | RangeCoord): void {
    const range =
      typeof rangeOrRef === "string"
        ? parseRangeRef(rangeOrRef)
        : rangeOrRef;
    this.workbook.namedRanges.set(name.toUpperCase(), range);
  }

  /**
   * Executes atomic batched mutations without triggering intermediary recalculations.
   */
  public batch<T>(fn: (batch: TransactionBatch) => T): { result: T; stats: RecalcStats } {
    const batch = new TransactionBatch();
    const result = fn(batch);
    const stats = this.applyBatch(batch);
    return { result, stats };
  }

  /**
   * Applies an existing TransactionBatch of mutations in a single recalculation wave.
   */
  public applyBatch(batch: TransactionBatch): RecalcStats {
    const mutations = batch.getMutations();
    this.isBatching = true;
    this.pendingBatchRoots = [];

    try {
      for (const m of mutations) {
        if (m.type === "set_cell") {
          this.setCell(m.sheetName, m.coord, m.rawInput ?? "");
        } else if (m.type === "clear_cell") {
          this.clearCell(m.sheetName, m.coord);
        } else if (m.type === "set_format") {
          const sheet = this.getOrCreateSheet(m.sheetName);
          const cell = sheet.getOrCreateCell(m.coord.row, m.coord.col);
          cell.format = m.format;
        }
      }
    } finally {
      this.isBatching = false;
    }

    const roots = [...this.pendingBatchRoots];
    this.pendingBatchRoots = [];
    return this.recalculate(roots);
  }

  /**
   * Triggers incremental reactive recalculation beginning at the specified mutated roots.
   */
  public recalculate(roots?: CellCoord[]): RecalcStats {
    const startTime = Date.now();
    let mutatedRoots: CellCoord[] = [];

    if (roots && roots.length > 0) {
      mutatedRoots = roots;
    } else {
      // Find all cells marked dirty or volatile
      for (const sheet of this.workbook.sheets) {
        for (const cell of sheet.getAllCells()) {
          if (cell.dirty) {
            mutatedRoots.push(cell.coord);
          }
        }
      }
      for (const volatileCoord of this.dag.getVolatileCoords()) {
        mutatedRoots.push(volatileCoord);
      }
    }

    // Detect cycles first
    const cyclicKeys = new Set<string>();
    const cycles = this.dag.detectCycles();
    const isIterative = this.workbook.calculationOptions.iterative;

    if (cycles.length > 0) {
      for (const cycle of cycles) {
        for (const key of cycle.cyclePath) {
          cyclicKeys.add(key.toUpperCase());
        }
      }

      if (!isIterative) {
        for (const cycle of cycles) {
          for (const key of cycle.cyclePath) {
            const c = keyToCoord(key);
            const err = TrellisError.refError("Circular dependency detected");
            this.setCellError(c, err);
          }
          this.events.emit("graph:cycle", {
            cyclePath: cycle.cyclePath.map(keyToCoord),
            error: TrellisError.refError("Circular dependency detected")
          });
        }
      }
    }

    // Plan calculation waves
    const plan = this.dag.planRecalculation(mutatedRoots);
    let evaluatedCount = 0;

    for (const wave of plan.waves) {
      for (const cellKeyStr of wave) {
        if (cyclicKeys.has(cellKeyStr.toUpperCase())) {
          continue;
        }
        const coord = keyToCoord(cellKeyStr);
        if (this.evaluateCell(coord)) {
          evaluatedCount++;
        }
      }
    }

    // Resolve cyclic components using iterative relaxation if enabled
    if (isIterative && cyclicKeys.size > 0) {
      const cyclicKeysList = Array.from(cyclicKeys);
      const maxIter = this.workbook.calculationOptions.maxIterations || 100;
      const tol = this.workbook.calculationOptions.tolerance || 1e-6;
      let converged = false;
      let iter = 0;

      while (iter < maxIter && !converged) {
        iter++;
        let maxDelta = 0;
        for (const key of cyclicKeysList) {
          const coord = keyToCoord(key);
          const sheetName = coord.sheet || this.workbook.activeSheet.name;
          const sheet = this.getOrCreateSheet(sheetName);
          const cell = sheet.getCell(coord.row, coord.col);
          const oldVal = cell ? cell.value : null;

          if (this.evaluateCell(coord)) {
            evaluatedCount++;
          }

          const newVal = cell ? cell.value : null;
          const oldNum = typeof oldVal === "number" ? oldVal : 0;
          const newNum = typeof newVal === "number" ? newVal : 0;
          const delta = Math.abs(newNum - oldNum);
          if (delta > maxDelta) {
            maxDelta = delta;
          }
        }

        if (maxDelta <= tol) {
          converged = true;
        }
      }

      // Propagate converged cyclic values to dependent downstream acyclic cells
      const downstreamPlan = this.dag.planRecalculation(cyclicKeysList.map(keyToCoord));
      for (const wave of downstreamPlan.waves) {
        for (const cellKeyStr of wave) {
          if (cyclicKeys.has(cellKeyStr.toUpperCase())) {
            continue;
          }
          const coord = keyToCoord(cellKeyStr);
          if (this.evaluateCell(coord)) {
            evaluatedCount++;
          }
        }
      }
    }

    const durationMs = Math.max(0, Date.now() - startTime);
    const stats: RecalcStats = {
      evaluatedCount,
      durationMs,
      waveCount: plan.waves.length
    };

    this.events.emit("calc:complete", {
      cellsEvaluated: evaluatedCount,
      durationMs,
      waves: plan.waves.length,
      dirtyCount: mutatedRoots.length
    });

    return stats;
  }

  private evaluateCell(coord: CellCoord): boolean {
    const sheetName = coord.sheet || this.workbook.activeSheet.name;
    const sheet = this.workbook.getSheet(sheetName);
    if (!sheet) return false;

    const cell = sheet.getCell(coord.row, coord.col);
    if (!cell || !cell.formula) {
      if (cell) cell.dirty = false;
      return false;
    }

    try {
      const chunk = this.getOrCompileBytecode(cell.formula, cell.ast);
      const evalCtx = new WorkbookEvaluationContext(
        this.workbook,
        this.spillManager,
        coord,
        sheetName
      );

      const result = VirtualMachine.evaluate(chunk, evalCtx);

      if (result instanceof TMatrix) {
        if (result.rowCount === 1 && result.colCount === 1) {
          // 1x1 scalar matrix
          cell.value = result.get(0, 0);
          this.spillManager.removeSpill(coord);
        } else {
          // Dynamic array allocation
          const isBlank = (c: CellCoord) => {
            const s = this.workbook.getSheet(c.sheet || sheetName);
            if (!s) return true;
            const target = s.getCell(c.row, c.col);
            return !target || target.raw === "" || target.value === null;
          };

          const spillRes = this.spillManager.allocateSpill(coord, result, isBlank);
          if (spillRes.success) {
            cell.value = result;
            cell.isSpillRoot = true;
            cell.spillRange = spillRes.range;
          } else {
            cell.value = spillRes.error;
            cell.isSpillRoot = false;
            this.events.emit("spill:collision", {
              root: coord,
              spillRange: spillRes.attemptedRange,
              blockedAt: spillRes.blockedCoord
            });
          }
        }
      } else {
        this.spillManager.removeSpill(coord);
        cell.value = result;
        cell.isSpillRoot = false;
      }

      cell.dirty = false;
      cell.lastCalculatedAt = Date.now();
      this.events.emit("cell:change", {
        coord,
        newValue: cell.value,
        formula: cell.formula
      });
      return true;
    } catch (err) {
      cell.value =
        err instanceof TrellisError
          ? err
          : TrellisError.calcError(err instanceof Error ? err.message : String(err));
      cell.dirty = false;
      this.events.emit("cell:change", {
        coord,
        newValue: cell.value,
        formula: cell.formula
      });
      return true;
    }
  }

  private registerFormulaDependencies(coord: CellCoord, formula: string): void {
    try {
      const ast = Parser.parse(formula);
      const sheetName = coord.sheet || this.workbook.activeSheet.name;
      const targetSheet = this.getOrCreateSheet(sheetName);
      const cell = targetSheet.getOrCreateCell(coord.row, coord.col);
      cell.ast = ast;

      const deps = extractDependencies(ast);

      // Normalize precedents to ensure explicit sheet names
      const normalizedCells: CellCoord[] = deps.cells.map((c) => ({
        ...c,
        sheet: c.sheet || sheetName
      }));

      const normalizedRanges: RangeCoord[] = deps.ranges.map((r) => ({
        ...r,
        sheet: r.sheet || sheetName
      }));

      this.dag.setDependencies(coord, normalizedCells, normalizedRanges, deps.isVolatile);
    } catch (err) {
      // Syntax parse error
      const targetSheet = this.getOrCreateSheet(coord.sheet || this.workbook.activeSheet.name);
      const cell = targetSheet.getOrCreateCell(coord.row, coord.col);
      cell.value = TrellisError.valueError(`Formula parse error: ${err}`);
      this.dag.removeCell(coord);
    }
  }

  private getOrCompileBytecode(formula: string, existingAst?: ASTNode): BytecodeChunk {
    let chunk = this.bytecodeCache.get(formula);
    if (!chunk) {
      const ast = existingAst || Parser.parse(formula);
      chunk = BytecodeCompiler.compile(ast);
      this.bytecodeCache.set(formula, chunk);
    }
    return chunk;
  }

  private normalizeCoord(sheetName: string, ref: string | CellCoord): CellCoord {
    if (typeof ref === "string") {
      const parsed = parseCellRef(ref);
      return {
        ...parsed,
        sheet: parsed.sheet || sheetName
      };
    }
    return {
      ...ref,
      sheet: ref.sheet || sheetName
    };
  }

  private getOrCreateSheet(sheetName: string): Sheet {
    let sheet = this.workbook.getSheet(sheetName);
    if (!sheet) {
      sheet = this.workbook.addSheet(sheetName);
    }
    return sheet;
  }

  private setCellError(coord: CellCoord, err: TrellisError): void {
    const sheetName = coord.sheet || this.workbook.activeSheet.name;
    const sheet = this.workbook.getSheet(sheetName);
    if (sheet) {
      const cell = sheet.getOrCreateCell(coord.row, coord.col);
      cell.value = err;
      cell.dirty = false;
    }
  }
}
