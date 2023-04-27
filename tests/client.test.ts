import { describe, it, assert, assertEqual } from "./framework.js";
import {
  ViewportManager,
  SelectionManager,
  AutocompleteEngine,
  ClipboardManager,
  DependencyVisualizer,
  FormulaBarController,
  CanvasGridRenderer,
  CanvasContext2D
} from "@trellis/client";
import { TrellisEngine } from "@trellis/engine";

describe("TrellisClient: Viewport Geometry and Hit Testing", () => {
  it("should calculate visible cell intervals and pixel bounding boxes", () => {
    const vp = new ViewportManager(800, 600);
    vp.scrollX = 150;
    vp.scrollY = 72;

    const visible = vp.computeVisibleRange();
    assert(visible.startCol >= 1, "startCol should reflect horizontal scroll offset");
    assert(visible.startRow >= 3, "startRow should reflect vertical scroll offset");

    const rectA1 = vp.getCellRect(0, 0);
    assertEqual(rectA1.width, 100);
    assertEqual(rectA1.height, 24);

    const hit = vp.hitTest(46 + 50, 24 + 12);
    assert(hit.row >= 0 && hit.col >= 0, "hit test must resolve non-negative cell coords");
  });
});

describe("TrellisClient: Selection Management and Fill Handle", () => {
  it("should select single cells and expand rectangular ranges", () => {
    const sm = new SelectionManager();
    sm.selectCell(2, 3);

    assertEqual(sm.cursor.row, 2);
    assertEqual(sm.cursor.col, 3);
    assertEqual(sm.isSelected(2, 3), true);
    assertEqual(sm.isSelected(0, 0), false);

    // Expand with shift key to (4, 5)
    sm.selectCell(4, 5, true);
    const range = sm.primaryRange;
    assertEqual(range.startRow, 2);
    assertEqual(range.startCol, 3);
    assertEqual(range.endRow, 4);
    assertEqual(range.endCol, 5);
    assertEqual(sm.isSelected(3, 4), true);
  });

  it("should manage fill handle dragging along dominant axis", () => {
    const sm = new SelectionManager();
    sm.selectCell(1, 1);
    sm.startFillDrag();
    assertEqual(sm.isDraggingFillHandle, true);

    sm.updateFillDrag({ row: 5, col: 1 });
    const target = sm.commitFillDrag();
    assert(target !== null, "Committed range must not be null");
    assertEqual(target!.startRow, 1);
    assertEqual(target!.endRow, 5);
    assertEqual(target!.startCol, 1);
    assertEqual(target!.endCol, 1);
  });
});

describe("TrellisClient: Autocomplete Engine", () => {
  it("should suggest functions matching prefixes and format signature hints", () => {
    const ac = new AutocompleteEngine();
    const suggestions = ac.getCompletions("=SU", 3);

    assert(suggestions.length > 0, "Suggestions should return matching functions");
    assert(suggestions.some((s) => s.name === "SUM"), "Suggestions must include SUM");

    // Active signature hint inside parentheses
    const hint = ac.getActiveSignatureHint("=XLOOKUP(A1, B1:B10, ", 21);
    assert(hint !== null, "Signature hint should be detected");
    assertEqual(hint!.functionName, "XLOOKUP");
    assertEqual(hint!.activeArgumentIndex, 2);
  });
});

describe("TrellisClient: Clipboard and Formula Shifting", () => {
  it("should shift relative cell references and preserve absolute pinning", () => {
    const cb = new ClipboardManager();
    const shifted = cb.shiftFormulaReferences("=A1 + $B$1 + C$2 + $D3", 2, 3);

    // A1 shifted by (+2 rows, +3 cols) -> D3
    // $B$1 (both pinned) -> $B$1
    // C$2 (col relative, row fixed) -> F$2
    // $D3 (col fixed, row relative) -> $D5
    assertEqual(shifted, "=D3 + $B$1 + F$2 + $D5");
  });

  it("should copy selection range to TSV and paste at target origin", () => {
    const engine = new TrellisEngine();
    engine.setCell("Sheet1", "A1", "10");
    engine.setCell("Sheet1", "B1", "20");
    engine.setCell("Sheet1", "A2", "30");
    engine.setCell("Sheet1", "B2", "40");

    const cb = new ClipboardManager();
    const payload = cb.copyRange(engine, "Sheet1", {
      startRow: 0,
      startCol: 0,
      endRow: 1,
      endCol: 1
    });

    assertEqual(payload.tsv, "10\t20\n30\t40");

    // Paste at C1 (row 0, col 2)
    cb.paste(engine, "Sheet1", { row: 0, col: 2 }, payload);

    assertEqual(engine.getCellValue("Sheet1", "C1"), 10);
    assertEqual(engine.getCellValue("Sheet1", "D1"), 20);
    assertEqual(engine.getCellValue("Sheet1", "C2"), 30);
    assertEqual(engine.getCellValue("Sheet1", "D2"), 40);
  });
});

describe("TrellisClient: Dependency Graph Visualizer", () => {
  it("should calculate curved arrow paths for precedent connections", () => {
    const engine = new TrellisEngine();
    engine.setCell("Sheet1", "A1", "100");
    engine.setCell("Sheet1", "B1", "=A1 * 2");

    const vp = new ViewportManager();
    const viz = new DependencyVisualizer();

    const arrows = viz.generateArrows(engine.dag, { row: 0, col: 1, sheet: "Sheet1" }, vp, "precedents");
    assertEqual(arrows.length, 1);
    assertEqual(arrows[0]!.kind, "precedent");
    assert(arrows[0]!.start.x < arrows[0]!.end.x, "Arrow should point from A1 to B1");
  });
});

describe("TrellisClient: Formula Bar Controller", () => {
  it("should track bracket pairs and commit formula edits", () => {
    const fbc = new FormulaBarController();
    fbc.startEdit({ row: 0, col: 0 }, "=IF(SUM(A1:A5) > 10, (1 + 2), 0)");

    const pairs = fbc.getBracketPairs();
    assertEqual(pairs.length, 3); // 3 pairs of parentheses

    const engine = new TrellisEngine();
    fbc.updateText("=5 * 5");
    fbc.commit(engine, "Sheet1");

    assertEqual(fbc.isEditing, false);
    assertEqual(engine.getCellValue("Sheet1", "A1"), 25);
  });
});

describe("TrellisClient: Canvas Grid Renderer", () => {
  it("should render visible grid cells into canvas context mock", () => {
    const engine = new TrellisEngine();
    engine.setCell("Sheet1", "A1", "Trellis Grid");

    const vp = new ViewportManager(400, 300);
    const sm = new SelectionManager();
    const renderer = new CanvasGridRenderer();

    let fillTextCalled = false;
    let strokeRectCount = 0;

    const mockCtx: CanvasContext2D = {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      font: "",
      textAlign: "left",
      textBaseline: "top",
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      bezierCurveTo: () => {},
      stroke: () => {},
      fill: () => {},
      fillRect: () => {},
      strokeRect: () => { strokeRectCount++; },
      clearRect: () => {},
      fillText: (_text) => { fillTextCalled = true; },
      measureText: (_text) => ({ width: 50 }),
      clip: () => {},
      rect: () => {}
    };

    renderer.render(mockCtx, engine, "Sheet1", vp, sm);
    assert(strokeRectCount > 0, "Grid lines should be drawn");
    assertEqual(fillTextCalled, true);
  });
});
