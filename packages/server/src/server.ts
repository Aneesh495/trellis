/**
 * HTTP and WebSocket collaboration daemon with zero external dependencies.
 * Uses native Node.js http and crypto modules to provide RFC 6455 WebSocket frames.
 */

import * as http from "node:http";
import * as crypto from "node:crypto";
import * as stream from "node:stream";
import { CollaborationSession } from "./session.js";
import {
  ProtocolMessage,
  serializeMessage,
  deserializeMessage
} from "./protocol.js";

const WS_MAGIC_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export interface ServerOptions {
  port?: number;
  host?: string;
}

export class TrellisServer {
  private readonly sessions: Map<string, CollaborationSession> = new Map();
  private httpServer: http.Server | null = null;
  private readonly startTime = Date.now();

  /**
   * Retrieves an existing session or creates a new one by identifier.
   */
  public getOrCreateSession(sessionId: string): CollaborationSession {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = new CollaborationSession(sessionId);
      this.sessions.set(sessionId, session);
    }
    return session;
  }

  public getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Starts HTTP and WebSocket server listening on the configured port.
   */
  public async start(options: ServerOptions = {}): Promise<number> {
    const port = options.port ?? 0;
    const host = options.host ?? "127.0.0.1";

    this.httpServer = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    this.httpServer.on("upgrade", (req, socket, head) => {
      this.handleWebSocketUpgrade(req, socket, head);
    });

    return new Promise((resolve, reject) => {
      this.httpServer!.listen(port, host, () => {
        const address = this.httpServer!.address();
        const actualPort = typeof address === "object" && address ? address.port : port;
        resolve(actualPort);
      });
      this.httpServer!.on("error", reject);
    });
  }

  /**
   * Gracefully shuts down the server.
   */
  public async stop(): Promise<void> {
    if (!this.httpServer) return;
    return new Promise((resolve, reject) => {
      this.httpServer!.close((err) => {
        if (err) reject(err);
        else resolve();
      });
      this.httpServer = null;
    });
  }

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          version: "1.0.0",
          uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
          activeSessions: this.sessions.size
        })
      );
      return;
    }

    if (pathname === "/api/sessions" && req.method === "GET") {
      const summary = Array.from(this.sessions.values()).map((s) => ({
        sessionId: s.sessionId,
        peerCount: s.peerCount,
        sheets: s.engine.workbook.sheets.map((sh) => sh.name)
      }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(summary));
      return;
    }

    if (pathname === "/api/eval" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        try {
          const payload = JSON.parse(body);
          const formula = payload.formula;
          const sessionId = payload.sessionId || "default";
          const session = this.getOrCreateSession(sessionId);

          const sheetName = payload.sheetName || session.engine.workbook.activeSheet.name;
          const t0 = Date.now();
          const val = session.engine.evaluateFormula(sheetName, formula);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              result: val,
              durationMs: Date.now() - t0
            })
          );
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Endpoint not found" }));
  }

  private handleWebSocketUpgrade(
    req: http.IncomingMessage,
    socket: stream.Duplex,
    _head: Buffer
  ): void {
    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }

    const digest = crypto
      .createHash("sha1")
      .update(key + WS_MAGIC_GUID)
      .digest("base64");

    const headers = [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${digest}`
    ];

    socket.write(headers.join("\r\n") + "\r\n\r\n");

    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const sessionId = url.searchParams.get("sessionId") || "default";
    const session = this.getOrCreateSession(sessionId);

    let assignedPeerId: string | null = null;

    const sendMsg = (msg: ProtocolMessage) => {
      this.sendWebSocketFrame(socket, serializeMessage(msg));
    };

    socket.on("data", (buffer) => {
      const messages = this.parseWebSocketFrames(buffer);
      for (const text of messages) {
        try {
          const protoMsg = deserializeMessage(text);
          if (protoMsg.type === "client_hello") {
            assignedPeerId = protoMsg.peerId;
            session.addPeer(protoMsg.peerId, protoMsg.name, protoMsg.color || "#3B82F6", sendMsg);
          }
          if (assignedPeerId) {
            session.handleMessage(assignedPeerId, protoMsg);
          }
        } catch (err) {
          console.error("Failed to parse websocket message:", err);
        }
      }
    });

    socket.on("close", () => {
      if (assignedPeerId) {
        session.removePeer(assignedPeerId);
      }
    });

    socket.on("error", () => {
      if (assignedPeerId) {
        session.removePeer(assignedPeerId);
      }
    });
  }

  private sendWebSocketFrame(socket: stream.Duplex, text: string): void {
    const payload = Buffer.from(text, "utf8");
    const len = payload.length;

    let header: Buffer;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x81; // FIN + text opcode
      header[1] = len;
    } else if (len <= 65535) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }

    socket.write(Buffer.concat([header, payload]));
  }

  private parseWebSocketFrames(buffer: Buffer): string[] {
    const results: string[] = [];
    let offset = 0;

    while (offset < buffer.length) {
      if (offset + 2 > buffer.length) break;

      const firstByte = buffer[offset++]!;
      const secondByte = buffer[offset++]!;

      const opcode = firstByte & 0x0f;
      if (opcode === 0x08) {
        // Close frame
        break;
      }

      const isMasked = (secondByte & 0x80) !== 0;
      let payloadLen = secondByte & 0x7f;

      if (payloadLen === 126) {
        if (offset + 2 > buffer.length) break;
        payloadLen = buffer.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLen === 127) {
        if (offset + 8 > buffer.length) break;
        payloadLen = Number(buffer.readBigUInt64BE(offset));
        offset += 8;
      }

      let maskKey: Buffer | null = null;
      if (isMasked) {
        if (offset + 4 > buffer.length) break;
        maskKey = buffer.subarray(offset, offset + 4);
        offset += 4;
      }

      if (offset + payloadLen > buffer.length) break;
      const payload = Buffer.alloc(payloadLen);
      buffer.copy(payload, 0, offset, offset + payloadLen);
      offset += payloadLen;

      if (isMasked && maskKey) {
        for (let i = 0; i < payloadLen; i++) {
          payload[i] = payload[i]! ^ maskKey[i % 4]!;
        }
      }

      if (opcode === 0x01) {
        results.push(payload.toString("utf8"));
      }
    }

    return results;
  }
}
