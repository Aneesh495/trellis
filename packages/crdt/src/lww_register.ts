/**
 * Last-Write-Wins (LWW) conflict-free replicated cell register with deterministic tie-breaking.
 */

import { HLC } from "./hlc.js";
import { PrimitiveValue } from "@trellis/core";

export interface CellRegisterState {
  readonly cellKey: string;
  readonly raw: string;
  readonly value: PrimitiveValue;
  readonly formula?: string;
  readonly hlc: HLC;
  readonly author: string;
}

export class LWWCellRegister {
  public cellKey: string;
  public raw: string;
  public value: PrimitiveValue;
  public formula?: string;
  public hlc: HLC;
  public author: string;

  constructor(state: CellRegisterState) {
    this.cellKey = state.cellKey;
    this.raw = state.raw;
    this.value = state.value;
    this.formula = state.formula;
    this.hlc = state.hlc;
    this.author = state.author;
  }

  /**
   * Merges an incoming remote state using Last-Write-Wins causal tie-breaking.
   * Returns true if local state was updated, false if remote was superseded.
   */
  public merge(remote: CellRegisterState): boolean {
    if (remote.cellKey.toUpperCase() !== this.cellKey.toUpperCase()) {
      return false;
    }

    const cmp = remote.hlc.compare(this.hlc);
    if (cmp > 0) {
      this.raw = remote.raw;
      this.value = remote.value;
      this.formula = remote.formula;
      this.hlc = remote.hlc;
      this.author = remote.author;
      return true;
    }

    return false;
  }

  public toState(): CellRegisterState {
    return {
      cellKey: this.cellKey,
      raw: this.raw,
      value: this.value,
      formula: this.formula,
      hlc: this.hlc,
      author: this.author
    };
  }
}
