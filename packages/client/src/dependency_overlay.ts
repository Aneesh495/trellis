/**
 * Interactive dependency graph visualizer rendering Bezier connection arrows across precedent and dependent cells.
 */

import { CellCoord, formatCellRef } from "@trellis/core";
import { DependencyDAG, keyToCoord } from "@trellis/graph";
import { ViewportManager } from "./viewport.js";
import { CanvasContext2D } from "./canvas_renderer.js";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface DependencyArrow {
  readonly fromCoord: CellCoord;
  readonly toCoord: CellCoord;
  readonly start: Point;
  readonly end: Point;
  readonly cp1: Point;
  readonly cp2: Point;
  readonly kind: "precedent" | "dependent";
  readonly color: string;
}

export class DependencyVisualizer {
  public precedentColor = "#3B82F6"; // Blue
  public dependentColor = "#10B981"; // Emerald green

  /**
   * Generates arrow paths connecting precedents and dependents for the focus cell.
   */
  public generateArrows(
    dag: DependencyDAG,
    focusCell: CellCoord,
    viewport: ViewportManager,
    mode: "precedents" | "dependents" | "both" = "both"
  ): DependencyArrow[] {
    const focusKey = formatCellRef(focusCell).toUpperCase();
    const node = dag.getNode(focusKey);
    if (!node) return [];

    const arrows: DependencyArrow[] = [];
    const focusRect = viewport.getCellRect(focusCell.row, focusCell.col);
    const focusCenter: Point = {
      x: focusRect.x + focusRect.width / 2,
      y: focusRect.y + focusRect.height / 2
    };

    // Precedents: arrows point from precedent to focus cell
    if (mode === "precedents" || mode === "both") {
      for (const precKey of node.precedents) {
        const precCoord = keyToCoord(precKey);
        const precRect = viewport.getCellRect(precCoord.row, precCoord.col);
        const precCenter: Point = {
          x: precRect.x + precRect.width / 2,
          y: precRect.y + precRect.height / 2
        };

        const { cp1, cp2 } = this.calculateCurvedControlPoints(precCenter, focusCenter);
        arrows.push({
          fromCoord: precCoord,
          toCoord: focusCell,
          start: precCenter,
          end: focusCenter,
          cp1,
          cp2,
          kind: "precedent",
          color: this.precedentColor
        });
      }
    }

    // Dependents: arrows point from focus cell to dependent
    if (mode === "dependents" || mode === "both") {
      for (const depKey of node.dependents) {
        const depCoord = keyToCoord(depKey);
        const depRect = viewport.getCellRect(depCoord.row, depCoord.col);
        const depCenter: Point = {
          x: depRect.x + depRect.width / 2,
          y: depRect.y + depRect.height / 2
        };

        const { cp1, cp2 } = this.calculateCurvedControlPoints(focusCenter, depCenter);
        arrows.push({
          fromCoord: focusCell,
          toCoord: depCoord,
          start: focusCenter,
          end: depCenter,
          cp1,
          cp2,
          kind: "dependent",
          color: this.dependentColor
        });
      }
    }

    return arrows;
  }

  /**
   * Renders the calculated arrows on canvas.
   */
  public render(ctx: CanvasContext2D, arrows: readonly DependencyArrow[]): void {
    ctx.save();

    for (const arrow of arrows) {
      ctx.strokeStyle = arrow.color;
      ctx.fillStyle = arrow.color;
      ctx.lineWidth = 2;

      // Draw origin dot
      ctx.beginPath();
      ctx.fillRect(arrow.start.x - 3, arrow.start.y - 3, 6, 6);

      // Draw smooth Bezier curve
      ctx.beginPath();
      ctx.moveTo(arrow.start.x, arrow.start.y);
      ctx.bezierCurveTo(arrow.cp1.x, arrow.cp1.y, arrow.cp2.x, arrow.cp2.y, arrow.end.x, arrow.end.y);
      ctx.stroke();

      // Draw arrowhead triangle at endpoint
      this.drawArrowHead(ctx, arrow.cp2, arrow.end);
    }

    ctx.restore();
  }

  private calculateCurvedControlPoints(
    start: Point,
    end: Point
  ): { cp1: Point; cp2: Point } {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const curvature = Math.min(60, Math.sqrt(dx * dx + dy * dy) * 0.2);

    return {
      cp1: { x: start.x + dx * 0.25, y: start.y + dy * 0.25 - curvature },
      cp2: { x: start.x + dx * 0.75, y: start.y + dy * 0.75 - curvature }
    };
  }

  private drawArrowHead(ctx: CanvasContext2D, from: Point, to: Point): void {
    const headLen = 8;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);

    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - headLen * Math.cos(angle - Math.PI / 6),
      to.y - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      to.x - headLen * Math.cos(angle + Math.PI / 6),
      to.y - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  }
}
