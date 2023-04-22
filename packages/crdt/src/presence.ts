/**
 * Ephemeral peer presence tracker for collaborative user cursors, selections, and heartbeats.
 */

import { CellCoord, RangeCoord } from "@trellis/core";

export interface PeerPresence {
  readonly peerId: string;
  readonly name: string;
  readonly color: string;
  sheetId: string;
  cursor: CellCoord | null;
  selection: RangeCoord | null;
  lastHeartbeat: number;
}

export class PresenceManager {
  private peers: Map<string, PeerPresence> = new Map();
  private localPeerId: string;
  private heartbeatTimeoutMs: number;

  constructor(localPeerId: string, heartbeatTimeoutMs: number = 30000) {
    this.localPeerId = localPeerId;
    this.heartbeatTimeoutMs = heartbeatTimeoutMs;
  }

  /**
   * Sets or updates presence information for a peer.
   */
  public updatePeer(presence: Omit<PeerPresence, "lastHeartbeat">): PeerPresence {
    const updated: PeerPresence = {
      ...presence,
      lastHeartbeat: Date.now()
    };
    this.peers.set(presence.peerId, updated);
    return updated;
  }

  /**
   * Updates the selection and cursor for a specific peer.
   */
  public updateSelection(
    peerId: string,
    sheetId: string,
    cursor: CellCoord | null,
    selection: RangeCoord | null
  ): boolean {
    const peer = this.peers.get(peerId);
    if (!peer) {
      return false;
    }
    peer.sheetId = sheetId;
    peer.cursor = cursor;
    peer.selection = selection;
    peer.lastHeartbeat = Date.now();
    return true;
  }

  /**
   * Removes a disconnected peer explicitly.
   */
  public removePeer(peerId: string): boolean {
    return this.peers.delete(peerId);
  }

  /**
   * Returns a list of active peers on a specific sheet, pruning expired peers.
   */
  public getActivePeers(sheetId?: string): PeerPresence[] {
    const now = Date.now();
    const active: PeerPresence[] = [];

    for (const [peerId, peer] of this.peers.entries()) {
      if (peerId !== this.localPeerId && now - peer.lastHeartbeat > this.heartbeatTimeoutMs) {
        this.peers.delete(peerId);
        continue;
      }

      if (sheetId === undefined || peer.sheetId === sheetId) {
        active.push({ ...peer });
      }
    }

    return active;
  }

  /**
   * Prunes all peers whose heartbeat has exceeded the timeout threshold.
   */
  public pruneExpiredPeers(): string[] {
    const now = Date.now();
    const expired: string[] = [];

    for (const [peerId, peer] of this.peers.entries()) {
      if (peerId !== this.localPeerId && now - peer.lastHeartbeat > this.heartbeatTimeoutMs) {
        expired.push(peerId);
        this.peers.delete(peerId);
      }
    }

    return expired;
  }

  public getPeer(peerId: string): PeerPresence | undefined {
    return this.peers.get(peerId);
  }

  public get peerCount(): number {
    return this.peers.size;
  }
}
