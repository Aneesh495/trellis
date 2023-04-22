/**
 * State vector delta replication protocol and CRDT synchronization engine.
 */

import { HLC } from "./hlc.js";
import { CellRegisterState, LWWCellRegister } from "./lww_register.js";

export type StateVector = Record<string, string>; // nodeId -> serialized HLC string

export interface SyncMessage {
  readonly type: "sync_step_1" | "sync_step_2" | "cell_update" | "presence_update";
  readonly senderId: string;
  readonly vector?: StateVector;
  readonly updates?: CellRegisterState[];
}

export class CellCRDTSyncEngine {
  private localNodeId: string;
  private hlc: HLC;
  private registers: Map<string, LWWCellRegister> = new Map();

  constructor(localNodeId: string) {
    this.localNodeId = localNodeId;
    this.hlc = HLC.create(localNodeId);
  }

  public getClock(): HLC {
    return this.hlc;
  }

  /**
   * Sets or edits a cell locally, advancing the local logical clock.
   */
  public setLocalCell(state: Omit<CellRegisterState, "hlc" | "author">): CellRegisterState {
    const nextHlc = this.hlc.now();
    const fullState: CellRegisterState = {
      ...state,
      hlc: nextHlc,
      author: this.localNodeId
    };

    const reg = new LWWCellRegister(fullState);
    this.registers.set(state.cellKey.toUpperCase(), reg);
    return fullState;
  }

  /**
   * Applies an incoming remote cell register update.
   */
  public applyRemoteUpdate(remote: CellRegisterState): boolean {
    this.hlc.update(remote.hlc);

    const key = remote.cellKey.toUpperCase();
    const existing = this.registers.get(key);

    if (!existing) {
      this.registers.set(key, new LWWCellRegister(remote));
      return true;
    }

    return existing.merge(remote);
  }

  /**
   * Computes the local state vector (latest observed HLC per node).
   */
  public getStateVector(): StateVector {
    const vector: Record<string, HLC> = {
      [this.localNodeId]: this.hlc
    };

    for (const reg of this.registers.values()) {
      const author = reg.hlc.nodeId;
      const current = vector[author];
      if (!current || reg.hlc.compare(current) > 0) {
        vector[author] = reg.hlc;
      }
    }

    const result: StateVector = {};
    for (const [nodeId, hlcVal] of Object.entries(vector)) {
      result[nodeId] = hlcVal.toString();
    }
    return result;
  }

  /**
   * Given a remote state vector, computes all local cell registers that are strictly
   * newer than the remote peer's knowledge.
   */
  public computeDelta(remoteVector: StateVector): CellRegisterState[] {
    const parsedVector: Map<string, HLC> = new Map();
    for (const [nodeId, hlcStr] of Object.entries(remoteVector)) {
      try {
        parsedVector.set(nodeId, HLC.fromString(hlcStr));
      } catch {
        // Skip malformed entries
      }
    }

    const delta: CellRegisterState[] = [];

    for (const reg of this.registers.values()) {
      const author = reg.hlc.nodeId;
      const remoteHlc = parsedVector.get(author);

      if (!remoteHlc || reg.hlc.compare(remoteHlc) > 0) {
        delta.push(reg.toState());
      }
    }

    return delta;
  }

  /**
   * Applies a batch of updates from a synchronization exchange.
   */
  public applySyncUpdates(updates: readonly CellRegisterState[]): number {
    let appliedCount = 0;
    for (const update of updates) {
      if (this.applyRemoteUpdate(update)) {
        appliedCount++;
      }
    }
    return appliedCount;
  }

  public getCellState(cellKey: string): CellRegisterState | undefined {
    return this.registers.get(cellKey.toUpperCase())?.toState();
  }

  public getAllStates(): CellRegisterState[] {
    return Array.from(this.registers.values()).map((r) => r.toState());
  }

  public get registerCount(): number {
    return this.registers.size;
  }
}
