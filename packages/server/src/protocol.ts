/**
 * Wire protocol specifications, message envelopes, and codecs for real-time collaboration.
 */

import { CellCoord, RangeCoord, CellValue } from "@trellis/core";
import { StateVector } from "@trellis/crdt";

export type MessageType =
  | "client_hello"
  | "server_hello"
  | "sync_step_1"
  | "sync_step_2"
  | "cell_updates"
  | "cursor_move"
  | "eval_req"
  | "eval_res"
  | "peer_joined"
  | "peer_left"
  | "error";

export interface BaseMessage {
  readonly type: MessageType;
  readonly traceId?: string;
  readonly timestamp?: number;
}

export interface ClientHelloMessage extends BaseMessage {
  readonly type: "client_hello";
  readonly peerId: string;
  readonly name: string;
  readonly color?: string;
  readonly protocolVersion: number;
}

export interface ServerHelloMessage extends BaseMessage {
  readonly type: "server_hello";
  readonly sessionId: string;
  readonly peerId: string;
  readonly activePeers: { peerId: string; name: string; color: string }[];
}

export interface SyncStep1Message extends BaseMessage {
  readonly type: "sync_step_1";
  readonly senderId: string;
  readonly vector: StateVector;
}

export interface SerializedCellDelta {
  readonly cellKey: string;
  readonly raw: string;
  readonly value: CellValue;
  readonly formula?: string;
  readonly hlc: string;
  readonly author: string;
}

export interface SyncStep2Message extends BaseMessage {
  readonly type: "sync_step_2";
  readonly senderId: string;
  readonly vector: StateVector;
  readonly deltas: SerializedCellDelta[];
}

export interface CellUpdatesMessage extends BaseMessage {
  readonly type: "cell_updates";
  readonly senderId: string;
  readonly updates: SerializedCellDelta[];
}

export interface CursorMoveMessage extends BaseMessage {
  readonly type: "cursor_move";
  readonly peerId: string;
  readonly sheetId: string;
  readonly cursor: CellCoord | null;
  readonly selection: RangeCoord | null;
}

export interface EvalReqMessage extends BaseMessage {
  readonly type: "eval_req";
  readonly reqId: string;
  readonly sheetName: string;
  readonly formula: string;
}

export interface EvalResMessage extends BaseMessage {
  readonly type: "eval_res";
  readonly reqId: string;
  readonly result: CellValue;
  readonly durationMs: number;
  readonly error?: string;
}

export interface PeerJoinedMessage extends BaseMessage {
  readonly type: "peer_joined";
  readonly peerId: string;
  readonly name: string;
  readonly color: string;
}

export interface PeerLeftMessage extends BaseMessage {
  readonly type: "peer_left";
  readonly peerId: string;
  readonly reason?: string;
}

export interface ProtocolErrorMessage extends BaseMessage {
  readonly type: "error";
  readonly code: string;
  readonly message: string;
}

export type ProtocolMessage =
  | ClientHelloMessage
  | ServerHelloMessage
  | SyncStep1Message
  | SyncStep2Message
  | CellUpdatesMessage
  | CursorMoveMessage
  | EvalReqMessage
  | EvalResMessage
  | PeerJoinedMessage
  | PeerLeftMessage
  | ProtocolErrorMessage;

/**
 * Serializes a protocol message into a compact JSON string.
 */
export function serializeMessage(msg: ProtocolMessage): string {
  return JSON.stringify(msg);
}

/**
 * Deserializes and validates an incoming raw JSON string into a typed protocol message.
 */
export function deserializeMessage(raw: string): ProtocolMessage {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
    throw new Error("Invalid protocol message: Missing message type");
  }
  return parsed as ProtocolMessage;
}
