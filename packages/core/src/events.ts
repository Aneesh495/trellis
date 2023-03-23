/**
 * Type-safe event emitter for reactive calculation, lifecycle hooks, and error telemetry.
 */

import { CellCoord, RangeCoord, CellValue } from "./types.js";
import { TrellisError } from "./errors.js";

export interface CellChangeEvent {
  coord: CellCoord;
  oldValue?: CellValue;
  newValue?: CellValue;
  formula?: string;
}

export interface RangeInvalidatedEvent {
  range: RangeCoord;
  reason: string;
}

export interface CycleDetectedEvent {
  cyclePath: CellCoord[];
  error: TrellisError;
}

export interface RecalculationStatsEvent {
  cellsEvaluated: number;
  durationMs: number;
  waves: number;
  dirtyCount: number;
}

export interface SpillCollisionEvent {
  root: CellCoord;
  spillRange: RangeCoord;
  blockedAt: CellCoord;
}

export type TrellisEventMap = {
  "cell:change": CellChangeEvent;
  "range:invalidated": RangeInvalidatedEvent;
  "graph:cycle": CycleDetectedEvent;
  "calc:complete": RecalculationStatsEvent;
  "spill:collision": SpillCollisionEvent;
};

type EventListener<T> = (payload: T) => void;

/**
 * High-performance typed event bus with unregister handles.
 */
export class TypedEventEmitter {
  private readonly listeners: Map<string, Set<EventListener<any>>> = new Map();

  public on<K extends keyof TrellisEventMap>(
    event: K,
    listener: EventListener<TrellisEventMap[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(listener);

    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  public emit<K extends keyof TrellisEventMap>(event: K, payload: TrellisEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;

    for (const listener of set) {
      try {
        listener(payload);
      } catch (err) {
        console.error(`Uncaught error in Trellis event listener for "${event}":`, err);
      }
    }
  }

  public removeAllListeners(): void {
    this.listeners.clear();
  }
}
