/**
 * Workbook container managing multi-sheet collections, named ranges, and global configuration.
 */

import { Sheet } from "./sheet.js";
import { StyleRegistry } from "./styles.js";
import { RangeCoord, TrellisError } from "@trellis/core";

export interface CalculationOptions {
  iterative: boolean;
  maxIterations: number;
  tolerance: number;
  dateMode: 1900 | 1904;
}

export const DEFAULT_CALCULATION_OPTIONS: CalculationOptions = {
  iterative: false,
  maxIterations: 100,
  tolerance: 1e-6,
  dateMode: 1900
};

export class Workbook {
  public readonly sheets: Sheet[] = [];
  public activeSheetIndex = 0;
  public readonly namedRanges: Map<string, RangeCoord> = new Map();
  public readonly styles: StyleRegistry = new StyleRegistry();
  public calculationOptions: CalculationOptions = { ...DEFAULT_CALCULATION_OPTIONS };

  constructor(initialSheetName = "Sheet1") {
    this.addSheet(initialSheetName);
  }

  public addSheet(name: string): Sheet {
    const existing = this.getSheet(name);
    if (existing) {
      throw TrellisError.valueError(`A sheet named '${name}' already exists in the workbook`);
    }
    const sheet = new Sheet(name);
    this.sheets.push(sheet);
    return sheet;
  }

  public getSheet(nameOrIndex: string | number): Sheet | undefined {
    if (typeof nameOrIndex === "number") {
      return this.sheets[nameOrIndex];
    }
    const searchName = nameOrIndex.toUpperCase();
    return this.sheets.find((s) => s.name.toUpperCase() === searchName);
  }

  public get activeSheet(): Sheet {
    return this.sheets[this.activeSheetIndex] || this.sheets[0]!;
  }

  public removeSheet(nameOrIndex: string | number): boolean {
    if (this.sheets.length <= 1) {
      throw TrellisError.valueError("Cannot remove the only sheet in a workbook");
    }
    let idx = -1;
    if (typeof nameOrIndex === "number") {
      idx = nameOrIndex;
    } else {
      idx = this.sheets.findIndex((s) => s.name.toUpperCase() === nameOrIndex.toUpperCase());
    }

    if (idx >= 0 && idx < this.sheets.length) {
      this.sheets.splice(idx, 1);
      if (this.activeSheetIndex >= this.sheets.length) {
        this.activeSheetIndex = this.sheets.length - 1;
      }
      return true;
    }
    return false;
  }

  public renameSheet(oldName: string, newName: string): boolean {
    const sheet = this.getSheet(oldName);
    if (!sheet) return false;
    const conflict = this.getSheet(newName);
    if (conflict && conflict !== sheet) {
      throw TrellisError.valueError(`A sheet named '${newName}' already exists`);
    }
    sheet.name = newName;
    return true;
  }

  public setNamedRange(name: string, range: RangeCoord): void {
    this.namedRanges.set(name.toUpperCase(), range);
  }

  public getNamedRange(name: string): RangeCoord | undefined {
    return this.namedRanges.get(name.toUpperCase());
  }

  public clear(): void {
    this.sheets.length = 0;
    this.namedRanges.clear();
    this.activeSheetIndex = 0;
  }
}
