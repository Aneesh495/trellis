/**
 * Selective undo and redo manager for collaborative cell operations.
 * Handles grouped multi-cell operations and inverted state applications.
 */

import { CellRegisterState } from "./lww_register.js";

export interface CellUndoEntry {
  readonly cellKey: string;
  readonly before: CellRegisterState | null;
  readonly after: CellRegisterState;
}

export interface UndoBatch {
  readonly id: string;
  readonly timestamp: number;
  readonly description?: string;
  readonly entries: readonly CellUndoEntry[];
}

export class UndoManager {
  private undoStack: UndoBatch[] = [];
  private redoStack: UndoBatch[] = [];
  private maxDepth: number;
  private currentBatch: CellUndoEntry[] | null = null;
  private currentBatchDescription?: string;

  constructor(maxDepth: number = 100) {
    this.maxDepth = maxDepth;
  }

  /**
   * Begins a grouped transaction batch (e.g. multi-cell paste or range fill).
   */
  public beginBatch(description?: string): void {
    if (this.currentBatch !== null) {
      this.commitBatch();
    }
    this.currentBatch = [];
    this.currentBatchDescription = description;
  }

  /**
   * Records a cell state transition.
   */
  public record(before: CellRegisterState | null, after: CellRegisterState): void {
    const entry: CellUndoEntry = {
      cellKey: after.cellKey,
      before: before ? { ...before } : null,
      after: { ...after }
    };

    if (this.currentBatch !== null) {
      this.currentBatch.push(entry);
    } else {
      const batch: UndoBatch = {
        id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        description: undefined,
        entries: [entry]
      };
      this.pushBatch(batch);
    }
  }

  /**
   * Commits the active grouped batch to the undo stack.
   */
  public commitBatch(): UndoBatch | null {
    if (!this.currentBatch || this.currentBatch.length === 0) {
      this.currentBatch = null;
      this.currentBatchDescription = undefined;
      return null;
    }

    const batch: UndoBatch = {
      id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      description: this.currentBatchDescription,
      entries: [...this.currentBatch]
    };

    this.currentBatch = null;
    this.currentBatchDescription = undefined;
    this.pushBatch(batch);
    return batch;
  }

  /**
   * Discards the active uncommitted batch.
   */
  public abortBatch(): void {
    this.currentBatch = null;
    this.currentBatchDescription = undefined;
  }

  private pushBatch(batch: UndoBatch): void {
    this.undoStack.push(batch);
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }
    // New local action invalidates the redo stack
    this.redoStack = [];
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Pops the topmost undo batch, returning inverted entries to restore previous states.
   */
  public undo(): UndoBatch | null {
    if (this.currentBatch !== null) {
      this.commitBatch();
    }
    const batch = this.undoStack.pop();
    if (!batch) {
      return null;
    }
    this.redoStack.push(batch);
    return batch;
  }

  /**
   * Pops the topmost redo batch, returning forward entries to re-apply states.
   */
  public redo(): UndoBatch | null {
    const batch = this.redoStack.pop();
    if (!batch) {
      return null;
    }
    this.undoStack.push(batch);
    return batch;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.currentBatch = null;
    this.currentBatchDescription = undefined;
  }

  public get undoCount(): number {
    return this.undoStack.length;
  }

  public get redoCount(): number {
    return this.redoStack.length;
  }
}
