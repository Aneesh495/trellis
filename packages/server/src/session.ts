/**
 * Multi-user collaboration session managing CRDT synchronization, presence, and engine reactivity.
 */

import { CellValue, TMatrix, parseCellRef } from "@trellis/core";
import { HLC, CellCRDTSyncEngine, PresenceManager, CellRegisterState } from "@trellis/crdt";
import { TrellisEngine } from "@trellis/engine";
import { BinaryCodec, JsonCodec, CsvCodec, Workbook } from "@trellis/storage";
import {
  ProtocolMessage,
  SerializedCellDelta,
  SyncStep2Message,
  ServerHelloMessage
} from "./protocol.js";

export interface ConnectedPeer {
  readonly peerId: string;
  readonly name: string;
  readonly color: string;
  readonly joinedAt: number;
  send(msg: ProtocolMessage): void;
}

export class CollaborationSession {
  public readonly sessionId: string;
  public readonly engine: TrellisEngine;
  public readonly syncEngine: CellCRDTSyncEngine;
  public readonly presence: PresenceManager;
  private readonly peers: Map<string, ConnectedPeer> = new Map();

  constructor(sessionId: string, workbook?: Workbook) {
    this.sessionId = sessionId;
    this.engine = new TrellisEngine(workbook);
    this.syncEngine = new CellCRDTSyncEngine(`server_${sessionId}`);
    this.presence = new PresenceManager(`server_${sessionId}`);
  }

  /**
   * Registers a newly connected peer to the session.
   */
  public addPeer(
    peerId: string,
    name: string,
    color: string,
    sendFn: (msg: ProtocolMessage) => void
  ): ConnectedPeer {
    const peer: ConnectedPeer = {
      peerId,
      name,
      color,
      joinedAt: Date.now(),
      send: sendFn
    };

    this.peers.set(peerId, peer);
    this.presence.updatePeer({
      peerId,
      name,
      color,
      sheetId: this.engine.workbook.activeSheet.name,
      cursor: null,
      selection: null
    });

    // Notify other peers
    this.broadcast(
      {
        type: "peer_joined",
        peerId,
        name,
        color
      },
      peerId
    );

    return peer;
  }

  /**
   * Disconnects a peer and purges presence state.
   */
  public removePeer(peerId: string, reason = "Disconnected"): boolean {
    const removed = this.peers.delete(peerId);
    if (removed) {
      this.presence.removePeer(peerId);
      this.broadcast({
        type: "peer_left",
        peerId,
        reason
      });
    }
    return removed;
  }

  /**
   * Dispatches and handles an incoming protocol message from a peer.
   */
  public handleMessage(peerId: string, msg: ProtocolMessage): void {
    const peer = this.peers.get(peerId);
    if (!peer && msg.type !== "client_hello") {
      return;
    }

    switch (msg.type) {
      case "client_hello": {
        const helloPeer = this.addPeer(
          msg.peerId,
          msg.name,
          msg.color || "#3B82F6",
          peer ? peer.send : () => {}
        );

        const activeList = Array.from(this.peers.values()).map((p) => ({
          peerId: p.peerId,
          name: p.name,
          color: p.color
        }));

        const serverHello: ServerHelloMessage = {
          type: "server_hello",
          sessionId: this.sessionId,
          peerId: helloPeer.peerId,
          activePeers: activeList
        };

        helloPeer.send(serverHello);
        break;
      }

      case "sync_step_1": {
        const deltas = this.syncEngine.computeDelta(msg.vector);
        const serializedDeltas: SerializedCellDelta[] = deltas.map((d) => ({
          cellKey: d.cellKey,
          raw: d.raw,
          value: d.value,
          formula: d.formula,
          hlc: d.hlc.toString(),
          author: d.author
        }));

        const reply: SyncStep2Message = {
          type: "sync_step_2",
          senderId: "server",
          vector: this.syncEngine.getStateVector(),
          deltas: serializedDeltas
        };

        peer!.send(reply);
        break;
      }

      case "sync_step_2": {
        this.applyIncomingDeltas(msg.deltas, peerId);
        break;
      }

      case "cell_updates": {
        this.applyIncomingDeltas(msg.updates, peerId);
        // Relay cell updates to other connected peers
        this.broadcast(msg, peerId);
        break;
      }

      case "cursor_move": {
        this.presence.updateSelection(peerId, msg.sheetId, msg.cursor, msg.selection);
        this.broadcast(msg, peerId);
        break;
      }

      case "eval_req": {
        const t0 = Date.now();
        let result: CellValue;
        let errStr: string | undefined;

        try {
          // Ephemeral calculation
          result = this.engine.getCellValue(msg.sheetName, msg.formula);
        } catch (err) {
          result = null;
          errStr = err instanceof Error ? err.message : String(err);
        }

        peer!.send({
          type: "eval_res",
          reqId: msg.reqId,
          result,
          durationMs: Date.now() - t0,
          error: errStr
        });
        break;
      }
    }
  }

  /**
   * Applies incoming CRDT deltas into local sync register and engine workbook.
   */
  public applyIncomingDeltas(deltas: readonly SerializedCellDelta[], senderId: string): void {
    const toEngineUpdates: { sheetName: string; ref: string; raw: string }[] = [];

    for (const delta of deltas) {
      const hlc = HLC.fromString(delta.hlc);
      const primVal = delta.value instanceof TMatrix ? delta.value.get(0, 0) : delta.value;
      const state: CellRegisterState = {
        cellKey: delta.cellKey,
        raw: delta.raw,
        value: primVal,
        formula: delta.formula,
        hlc,
        author: delta.author || senderId
      };

      const applied = this.syncEngine.applyRemoteUpdate(state);
      if (applied) {
        const parsed = parseCellRef(delta.cellKey);
        const sheetName = parsed.sheet || this.engine.workbook.activeSheet.name;
        toEngineUpdates.push({
          sheetName,
          ref: delta.cellKey,
          raw: delta.raw
        });
      }
    }

    if (toEngineUpdates.length > 0) {
      this.engine.batch((b) => {
        for (const u of toEngineUpdates) {
          const parsed = parseCellRef(u.ref);
          b.setCell(u.sheetName, parsed, u.raw);
        }
      });
    }
  }

  /**
   * Broadcasts a protocol message to connected peers, optionally excluding sender.
   */
  public broadcast(msg: ProtocolMessage, excludePeerId?: string): void {
    for (const [peerId, peer] of this.peers.entries()) {
      if (peerId !== excludePeerId) {
        try {
          peer.send(msg);
        } catch (err) {
          console.error(`Failed to send message to peer ${peerId}:`, err);
        }
      }
    }
  }

  public exportBinary(): Uint8Array {
    return BinaryCodec.serialize(this.engine.workbook);
  }

  public exportJson(): string {
    return JsonCodec.serialize(this.engine.workbook);
  }

  public exportCsv(sheetName?: string): string {
    const sheet = this.engine.workbook.getSheet(sheetName || this.engine.workbook.activeSheet.name);
    if (!sheet) return "";
    return CsvCodec.serialize(sheet);
  }

  public get peerCount(): number {
    return this.peers.size;
  }
}
