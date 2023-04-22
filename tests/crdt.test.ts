import { describe, it, assert, assertEqual, assertDeepEqual } from "./framework.js";
import {
  HLC,
  LWWCellRegister,
  FractionalSequence,
  generateFractionalKey,
  UndoManager,
  PresenceManager,
  CellCRDTSyncEngine
} from "@trellis/crdt";

describe("CRDT Hybrid Logical Clock (HLC)", () => {
  it("should create monotonically increasing clocks", () => {
    const clock = HLC.create("node_a");
    const t1 = clock.now();
    const t2 = clock.now();

    assert(t2.compare(t1) > 0, "Clock t2 must be greater than t1");
  });

  it("should update clock when receiving higher remote timestamp", () => {
    const clockA = HLC.create("node_a");
    const clockB = HLC.create("node_b");

    const tB = clockB.now();
    // Advance remote clock by artificially creating a higher millis
    const advancedRemote = new HLC(tB.millis + 5000, 10, "node_b");

    const tA = clockA.update(advancedRemote);
    assert(tA.compare(advancedRemote) > 0, "Updated clock must be strictly greater than remote");
    assert(tA.millis >= advancedRemote.millis, "Clock millis must reflect or exceed remote");
  });

  it("should round-trip string serialization and deserialization", () => {
    const clock = new HLC(1729000000000, 42, "peer_xyz");
    const token = clock.toString();
    const parsed = HLC.fromString(token);

    assertEqual(parsed.millis, clock.millis);
    assertEqual(parsed.counter, clock.counter);
    assertEqual(parsed.nodeId, clock.nodeId);
    assertEqual(parsed.compare(clock), 0);
  });
});

describe("CRDT LWWCellRegister", () => {
  it("should accept newer updates and reject older updates", () => {
    const clock1 = new HLC(1000, 0, "node_1");
    const reg = new LWWCellRegister({
      cellKey: "A1",
      raw: "100",
      value: 100,
      hlc: clock1,
      author: "node_1"
    });

    const clock2 = new HLC(1000, 1, "node_2");
    const updated = reg.merge({
      cellKey: "A1",
      raw: "200",
      value: 200,
      hlc: clock2,
      author: "node_2"
    });

    assertEqual(updated, true);
    assertEqual(reg.value, 200);

    // Stale update with earlier clock
    const clockStale = new HLC(900, 5, "node_3");
    const rejected = reg.merge({
      cellKey: "A1",
      raw: "50",
      value: 50,
      hlc: clockStale,
      author: "node_3"
    });

    assertEqual(rejected, false);
    assertEqual(reg.value, 200);
  });
});

describe("CRDT Fractional Indexing Sequence", () => {
  it("should generate keys strictly between two bounds", () => {
    const key1 = generateFractionalKey(null, null);
    const key2 = generateFractionalKey(key1, null);
    const keyMid = generateFractionalKey(key1, key2);

    assert(key1 < key2, "key1 must be less than key2");
    assert(key1 < keyMid, "key1 must be less than keyMid");
    assert(keyMid < key2, "keyMid must be less than key2");
  });

  it("should maintain sequential ordering in FractionalSequence", () => {
    const seq = new FractionalSequence<string>();
    const item1 = seq.insertAfter(null, "row_1", "First Row");
    const item3 = seq.insertAfter(item1.id, "row_3", "Third Row");
    seq.insertAfter(item1.id, "row_2", "Second Row");

    const active = seq.getActiveItems();
    assertEqual(active.length, 3);
    assertEqual(active[0], "First Row");
    assertEqual(active[1], "Second Row");
    assertEqual(active[2], "Third Row");

    seq.delete(item3.id);
    assertEqual(seq.getActiveItems().length, 2);
    assertEqual(seq.getActiveItems()[1], "Second Row");
  });
});

describe("CRDT UndoManager", () => {
  it("should record and undo single and batched operations", () => {
    const undoMgr = new UndoManager();
    const hlc = HLC.create("node_test");

    const stateA1_v1 = {
      cellKey: "A1",
      raw: "10",
      value: 10,
      hlc: hlc.now(),
      author: "node_test"
    };

    const stateA1_v2 = {
      cellKey: "A1",
      raw: "20",
      value: 20,
      hlc: hlc.now(),
      author: "node_test"
    };

    undoMgr.record(stateA1_v1, stateA1_v2);
    assertEqual(undoMgr.canUndo(), true);
    assertEqual(undoMgr.canRedo(), false);

    const undone = undoMgr.undo();
    assert(undone !== null, "Undone batch must not be null");
    assertEqual(undone!.entries[0]!.before!.value, 10);
    assertEqual(undoMgr.canRedo(), true);

    const redone = undoMgr.redo();
    assert(redone !== null, "Redone batch must not be null");
    assertEqual(redone!.entries[0]!.after.value, 20);
  });

  it("should group multi-cell changes into an atomic transaction batch", () => {
    const undoMgr = new UndoManager();
    const hlc = HLC.create("node_test");

    undoMgr.beginBatch("Paste Range");
    undoMgr.record(null, {
      cellKey: "A1",
      raw: "1",
      value: 1,
      hlc: hlc.now(),
      author: "node_test"
    });
    undoMgr.record(null, {
      cellKey: "A2",
      raw: "2",
      value: 2,
      hlc: hlc.now(),
      author: "node_test"
    });
    undoMgr.commitBatch();

    assertEqual(undoMgr.undoCount, 1);
    const undone = undoMgr.undo();
    assertEqual(undone!.entries.length, 2);
  });
});

describe("CRDT PresenceManager", () => {
  it("should track peer cursors and selections and prune timed out peers", () => {
    const presence = new PresenceManager("local_user", 100);

    presence.updatePeer({
      peerId: "alice",
      name: "Alice",
      color: "#FF0000",
      sheetId: "Sheet1",
      cursor: { row: 1, col: 1 },
      selection: { startRow: 1, startCol: 1, endRow: 3, endCol: 3 }
    });

    const active = presence.getActivePeers("Sheet1");
    assertEqual(active.length, 1);
    assertEqual(active[0]!.name, "Alice");

    // Manually age the heartbeat
    const alice = presence.getPeer("alice")!;
    alice.lastHeartbeat -= 200;

    const pruned = presence.pruneExpiredPeers();
    assertDeepEqual(pruned, ["alice"]);
    assertEqual(presence.getActivePeers().length, 0);
  });
});

describe("CRDT SyncEngine and Delta Replication", () => {
  it("should synchronize divergent peers to exact convergence", () => {
    const peerA = new CellCRDTSyncEngine("node_a");
    const peerB = new CellCRDTSyncEngine("node_b");

    // Peer A edits A1 and A2
    peerA.setLocalCell({ cellKey: "A1", raw: "Apple", value: "Apple" });
    peerA.setLocalCell({ cellKey: "A2", raw: "100", value: 100 });

    // Peer B edits B1 and B2
    peerB.setLocalCell({ cellKey: "B1", raw: "Banana", value: "Banana" });
    peerB.setLocalCell({ cellKey: "B2", raw: "200", value: 200 });

    // Synchronization exchange:
    // 1. Peer B sends state vector to Peer A
    const vectorB = peerB.getStateVector();
    // 2. Peer A computes delta for Peer B
    const deltaForB = peerA.computeDelta(vectorB);
    assertEqual(deltaForB.length, 2);

    // 3. Peer A sends state vector to Peer B
    const vectorA = peerA.getStateVector();
    // 4. Peer B computes delta for Peer A
    const deltaForA = peerB.computeDelta(vectorA);
    assertEqual(deltaForA.length, 2);

    // 5. Apply deltas
    peerB.applySyncUpdates(deltaForB);
    peerA.applySyncUpdates(deltaForA);

    // Both peers should now have all 4 cells with identical state
    assertEqual(peerA.registerCount, 4);
    assertEqual(peerB.registerCount, 4);

    assertEqual(peerA.getCellState("A1")?.value, "Apple");
    assertEqual(peerB.getCellState("A1")?.value, "Apple");
    assertEqual(peerA.getCellState("B1")?.value, "Banana");
    assertEqual(peerB.getCellState("B1")?.value, "Banana");
  });
});
