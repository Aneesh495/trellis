/**
 * Formula bar state controller, bracket matching, and keyboard event dispatch.
 */

import { CellCoord } from "@trellis/core";
import { TrellisEngine } from "@trellis/engine";

export interface BracketPair {
  readonly openIndex: number;
  readonly closeIndex: number;
  readonly depth: number;
}

export class FormulaBarController {
  public isEditing = false;
  public rawText = "";
  public cursorPosition = 0;
  public activeCoord: CellCoord = { row: 0, col: 0 };

  /**
   * Begins editing the specified cell with optional initial text.
   */
  public startEdit(coord: CellCoord, initialText = ""): void {
    this.isEditing = true;
    this.activeCoord = { ...coord };
    this.rawText = initialText;
    this.cursorPosition = initialText.length;
  }

  /**
   * Updates formula input text and cursor offset.
   */
  public updateText(text: string, cursorPosition?: number): void {
    this.rawText = text;
    this.cursorPosition = cursorPosition !== undefined ? cursorPosition : text.length;
  }

  /**
   * Commits the edited formula into the calculation engine.
   */
  public commit(engine: TrellisEngine, sheetName: string): void {
    if (!this.isEditing) return;

    engine.setCell(sheetName, this.activeCoord, this.rawText);
    this.isEditing = false;
  }

  /**
   * Cancels the edit session without persisting mutations.
   */
  public cancel(): void {
    this.isEditing = false;
    this.rawText = "";
  }

  /**
   * Finds all matching bracket pairs in the current text input for syntax coloring.
   */
  public getBracketPairs(): BracketPair[] {
    const pairs: BracketPair[] = [];
    const stack: { index: number; depth: number }[] = [];

    for (let i = 0; i < this.rawText.length; i++) {
      const ch = this.rawText[i];
      if (ch === "(") {
        stack.push({ index: i, depth: stack.length });
      } else if (ch === ")") {
        const top = stack.pop();
        if (top) {
          pairs.push({
            openIndex: top.index,
            closeIndex: i,
            depth: top.depth
          });
        }
      }
    }

    return pairs;
  }
}
