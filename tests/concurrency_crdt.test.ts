import { describe, it, assert, assertEqual } from "./framework.js";
import { CellCRDTSyncEngine, CellRegisterState } from "@trellis/crdt";

describe("CRDT: Multi-Peer Concurrency and Out-of-Order Delta Replication", () => {
  let seed = 98765;
  function random(): number {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }

  function randomInt(min: number, max: number): number {
    return Math.floor(random() * (max - min + 1)) + min;
  }

  it("converges 5 concurrent peers with randomized out-of-order delta delivery", () => {
    const peerIds = ["peer-A", "peer-B", "peer-C", "peer-D", "peer-E"];
    const engines = new Map<string, CellCRDTSyncEngine>();

    for (const pid of peerIds) {
      engines.set(pid, new CellCRDTSyncEngine(pid));
    }

    // Network bus holding in-flight update packets
    const allUpdates: CellRegisterState[] = [];

    // Each peer produces 15 local operations on a shared 5x5 grid (cells A1 to E5)
    for (const pid of peerIds) {
      const engine = engines.get(pid)!;
      for (let op = 0; op < 15; op++) {
        const colLetter = String.fromCharCode(65 + randomInt(0, 4));
        const rowNum = randomInt(1, 5);
        const cellKey = `${colLetter}${rowNum}`;
        const val = `${pid}:val-${op}`;
        const update = engine.setLocalCell({ cellKey, raw: val, value: val });
        allUpdates.push(update);
      }
    }

    assertEqual(allUpdates.length, 75);

    // Shuffle update packets randomly to simulate out-of-order delivery
    for (let i = allUpdates.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const temp = allUpdates[i]!;
      allUpdates[i] = allUpdates[j]!;
      allUpdates[j] = temp;
    }

    // Deliver all shuffled updates to each peer
    for (const pid of peerIds) {
      const engine = engines.get(pid)!;
      engine.applySyncUpdates(allUpdates);
    }

    // Verification: all 5 peers must have converged to identical state on all touched cells
    const referenceEngine = engines.get("peer-A")!;
    for (let c = 0; c < 5; c++) {
      for (let r = 1; r <= 5; r++) {
        const key = `${String.fromCharCode(65 + c)}${r}`;
        const refState = referenceEngine.getCellState(key);
        const refVal = refState ? refState.value : null;

        for (const pid of peerIds.slice(1)) {
          const peerEngine = engines.get(pid)!;
          const peerState = peerEngine.getCellState(key);
          const peerVal = peerState ? peerState.value : null;

          assertEqual(
            peerVal,
            refVal,
            `Divergence at cell ${key} between peer-A and ${pid}: '${refVal}' !== '${peerVal}'`
          );
        }
      }
    }
  });

  it("correctly resolves concurrent conflicting writes on a single cell via HLC timestamps", () => {
    const peer1 = new CellCRDTSyncEngine("client-1");
    const peer2 = new CellCRDTSyncEngine("client-2");

    const u1 = peer1.setLocalCell({ cellKey: "A1", raw: "first", value: "first" });
    const u2 = peer2.setLocalCell({ cellKey: "A1", raw: "second", value: "second" });

    // Deliver u2 first to peer1, then u1
    peer1.applySyncUpdates([u2, u1]);
    // Deliver u1 first to peer2, then u2
    peer2.applySyncUpdates([u1, u2]);

    const state1 = peer1.getCellState("A1");
    const state2 = peer2.getCellState("A1");

    assert(state1 !== undefined, "Expected state1 to be defined");
    assert(state2 !== undefined, "Expected state2 to be defined");
    assertEqual(state1?.value, state2?.value);
  });
});
