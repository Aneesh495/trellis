import { describe, it, assert, assertEqual } from "./framework.js";
import { SpillManager } from "../packages/spill/src/index.js";
import { TMatrix, parseCellRef, formatCellRef, TrellisError, ErrorCode } from "@trellis/core";

describe("Spill: Dynamic Array Allocation and Collision Management", () => {
  it("allocates a 2D matrix spill across blank cells", () => {
    const mgr = new SpillManager();
    const root = parseCellRef("A1");
    const mat = new TMatrix([
      [10, 20],
      [30, 40],
      [50, 60]
    ]);

    // All cells in sheet are initially blank
    const res = mgr.allocateSpill(root, mat, () => true);
    assertEqual(res.success, true);
    if (res.success) {
      assertEqual(res.range.startRow, 0);
      assertEqual(res.range.startCol, 0);
      assertEqual(res.range.endRow, 2);
      assertEqual(res.range.endCol, 1);
    }

    // Check spill child queries
    const b2 = parseCellRef("B2");
    assert(mgr.isSpillChild(b2));
    assertEqual(mgr.getSpillValue(b2), 40);

    const b3 = parseCellRef("B3");
    assert(mgr.isSpillChild(b3));
    assertEqual(mgr.getSpillValue(b3), 60);

    // Root cell itself is the owner, not a child
    assert(!mgr.isSpillChild(root));
  });

  it("detects collisions when a target cell contains non-blank data", () => {
    const mgr = new SpillManager();
    const root = parseCellRef("A1");
    const mat = new TMatrix([
      [1, 2],
      [3, 4]
    ]);

    // B2 is non-blank (e.g. contains an existing manual value)
    const isBlank = (coord: any) => !(coord.row === 1 && coord.col === 1);

    const res = mgr.allocateSpill(root, mat, isBlank);
    assertEqual(res.success, false);
    if (!res.success) {
      assertEqual(res.blockedReason, "COLLISION_WITH_DATA");
      assertEqual(formatCellRef(res.blockedCoord), "B2");
      assert(TrellisError.isError(res.error));
      assertEqual(res.error.code, ErrorCode.SPILL);
    }
  });

  it("recovers and spills cleanly when the blocking cell is cleared", () => {
    const mgr = new SpillManager();
    const root = parseCellRef("A1");
    const mat = new TMatrix([
      [1, 2],
      [3, 4]
    ]);

    let b2Blocked = true;
    const isBlank = (coord: any) => !(coord.row === 1 && coord.col === 1 && b2Blocked);

    // Initial attempt blocked
    const firstRes = mgr.allocateSpill(root, mat, isBlank);
    assertEqual(firstRes.success, false);

    // User clears B2
    b2Blocked = false;
    const secondRes = mgr.allocateSpill(root, mat, isBlank);
    assertEqual(secondRes.success, true);

    const b2 = parseCellRef("B2");
    assert(mgr.isSpillChild(b2));
    assertEqual(mgr.getSpillValue(b2), 4);
  });

  it("detects collisions between two overlapping dynamic arrays", () => {
    const mgr = new SpillManager();
    const root1 = parseCellRef("A1");
    const mat1 = new TMatrix([
      [1, 2, 3],
      [4, 5, 6]
    ]); // Spills over A1:C2

    const res1 = mgr.allocateSpill(root1, mat1, () => true);
    assertEqual(res1.success, true);

    // Second array at B1 attempts to spill over B1:B3, which overlaps A1:C2 at B1 and B2
    const root2 = parseCellRef("B1");
    const mat2 = new TMatrix([[10], [20], [30]]);
    const res2 = mgr.allocateSpill(root2, mat2, () => true);

    assertEqual(res2.success, false);
    if (!res2.success) {
      assertEqual(res2.blockedReason, "COLLISION_WITH_SPILL");
    }
  });

  it("cleans up ghost child mappings when an array is removed", () => {
    const mgr = new SpillManager();
    const root = parseCellRef("C1");
    const mat = new TMatrix([
      [10, 20],
      [30, 40]
    ]);

    mgr.allocateSpill(root, mat, () => true);
    const d2 = parseCellRef("D2");
    assert(mgr.isSpillChild(d2));

    mgr.removeSpill(root);
    assert(!mgr.isSpillChild(d2));
    assertEqual(mgr.getSpillValue(d2), null);
  });
});
