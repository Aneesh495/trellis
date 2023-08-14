import { benchmark } from "./framework.js";
import { HLC, CellCRDTSyncEngine, CellRegisterState } from "@trellis/crdt";

const hlc = new HLC(1700000000000, 0, "bench-node");

// Pre-build peer engines with 5,000 registers
const engineA = new CellCRDTSyncEngine("peer-A");
const engineB = new CellCRDTSyncEngine("peer-B");

const preparedUpdates: CellRegisterState[] = [];
for (let i = 0; i < 5000; i++) {
  const key = `R${i}C1`;
  const val = `value-${i}`;
  const u = engineA.setLocalCell({ cellKey: key, raw: val, value: val });
  preparedUpdates.push(u);
}

const vectorB = engineB.getStateVector();

benchmark("CRDT: Hybrid Logical Clock Timestamp Generation", () => {
  hlc.now();
}, { warmupIterations: 1000, minDurationMs: 150 });

benchmark("CRDT: State Vector Delta Computation (5,000 Cells)", () => {
  engineA.computeDelta(vectorB);
}, { warmupIterations: 100, minDurationMs: 150 });

benchmark("CRDT: Remote Delta Apply and Merge Latency", () => {
  engineB.applySyncUpdates(preparedUpdates);
}, { warmupIterations: 50, minDurationMs: 150 });
