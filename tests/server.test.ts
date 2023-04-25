import { describe, it, assert, assertEqual, assertDeepEqual } from "./framework.js";
import {
  TrellisServer,
  CollaborationSession,
  serializeMessage,
  deserializeMessage,
  ClientHelloMessage,
  CellUpdatesMessage
} from "@trellis/server";
import { HLC } from "@trellis/crdt";

describe("TrellisServer: Wire Protocol Codec", () => {
  it("should round-trip serialize and deserialize protocol messages", () => {
    const hello: ClientHelloMessage = {
      type: "client_hello",
      peerId: "alice_client",
      name: "Alice",
      color: "#FF0000",
      protocolVersion: 1
    };

    const encoded = serializeMessage(hello);
    const decoded = deserializeMessage(encoded);
    assertDeepEqual(decoded, hello);
  });
});

describe("TrellisServer: CollaborationSession CRDT Synchronization", () => {
  it("should handle peer join, state vector sync, and cell updates", () => {
    const session = new CollaborationSession("test_session");

    const peerAMessages: any[] = [];
    const peerBMessages: any[] = [];

    // Peer A connects
    session.addPeer("peer_a", "Alice", "#3B82F6", (msg) => {
      peerAMessages.push(msg);
    });

    // Peer B connects
    session.addPeer("peer_b", "Bob", "#10B981", (msg) => {
      peerBMessages.push(msg);
    });

    // Peer A should have received a peer_joined notification for Bob
    assertEqual(peerAMessages.length, 1);
    assertEqual(peerAMessages[0].type, "peer_joined");
    assertEqual(peerAMessages[0].peerId, "peer_b");

    // Peer A submits cell update: A1 = 500
    const hlcA = HLC.create("peer_a").now();
    const updateMsg: CellUpdatesMessage = {
      type: "cell_updates",
      senderId: "peer_a",
      updates: [
        {
          cellKey: "A1",
          raw: "500",
          value: 500,
          hlc: hlcA.toString(),
          author: "peer_a"
        }
      ]
    };

    session.handleMessage("peer_a", updateMsg);

    // Engine should reflect new value
    assertEqual(session.engine.getCellValue("Sheet1", "A1"), 500);

    // Peer B should have received relayed cell updates
    const bRelayed = peerBMessages.find((m) => m.type === "cell_updates");
    assert(bRelayed !== undefined, "Peer B must receive relayed cell updates");
    assertEqual(bRelayed.updates[0].cellKey, "A1");
    assertEqual(bRelayed.updates[0].value, 500);
  });

  it("should export session data to JSON and CSV", () => {
    const session = new CollaborationSession("export_test");
    session.engine.setCell("Sheet1", "A1", "Product");
    session.engine.setCell("Sheet1", "B1", "Revenue");
    session.engine.setCell("Sheet1", "A2", "Widget");
    session.engine.setCell("Sheet1", "B2", "1250");

    const json = session.exportJson();
    assert(json.includes("export_test") || json.includes("Widget"), "JSON export must contain data");

    const csv = session.exportCsv("Sheet1");
    assert(csv.includes("Product,Revenue"), "CSV export must contain headers");
    assert(csv.includes("Widget,1250"), "CSV export must contain row values");
  });
});

describe("TrellisServer: HTTP REST Daemon", () => {
  it("should serve health check and formula evaluation endpoints", async () => {
    const server = new TrellisServer();
    const port = await server.start();

    try {
      // 1. Health check
      const healthRes = await fetch(`http://127.0.0.1:${port}/health`);
      assertEqual(healthRes.status, 200);
      const healthData = await healthRes.json() as any;
      assertEqual(healthData.status, "ok");
      assertEqual(healthData.version, "1.0.0");

      // 2. Eval endpoint
      const evalRes = await fetch(`http://127.0.0.1:${port}/api/eval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "eval_session",
          formula: "=SUM(10, 20, 30)"
        })
      });

      assertEqual(evalRes.status, 200);
      const evalData = await evalRes.json() as any;
      assertEqual(evalData.result, 60);
    } finally {
      await server.stop();
    }
  });
});
