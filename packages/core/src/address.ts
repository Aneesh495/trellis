/**
 * High-performance A1 coordinate parser, formatter, and geometric range algebra.
 */

import { CellCoord, RangeCoord } from "./types.js";
import { TrellisError } from "./errors.js";

/**
 * Maximum bounds supported by the tabular grid architecture.
 */
export const MAX_ROWS = 1_048_576;
export const MAX_COLS = 16_384;

/**
 * Converts a 0-indexed column integer to an alphabetical column label (0 -> "A", 27 -> "AB").
 */
export function colToIndex(colStr: string): number {
  const upper = colStr.toUpperCase();
  let index = 0;
  for (let i = 0; i < upper.length; i++) {
    const charCode = upper.charCodeAt(i);
    if (charCode < 65 || charCode > 90) {
      throw TrellisError.refError(`Invalid column identifier character: ${colStr[i]}`);
    }
    index = index * 26 + (charCode - 64);
  }
  return index - 1;
}

/**
 * Converts an alphabetical column label to a 0-indexed column integer ("A" -> 0, "AB" -> 27).
 */
export function indexToCol(index: number): string {
  if (index < 0) {
    throw TrellisError.refError(`Column index out of lower bounds: ${index}`);
  }
  let col = "";
  let temp = index + 1;
  while (temp > 0) {
    const rem = (temp - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    temp = Math.floor((temp - 1) / 26);
  }
  return col;
}

const CELL_REGEX = /^(?:(?:'([^']+)'|([A-Za-z0-9_]+))!)?(\$?)([A-Za-z]+)(\$?)([0-9]+)$/;
const RANGE_REGEX = /^(?:(?:'([^']+)'|([A-Za-z0-9_]+))!)?(\$?)([A-Za-z]+)(\$?)([0-9]+):(\$?)([A-Za-z]+)(\$?)([0-9]+)$/;
const WHOLE_COL_REGEX = /^(?:(?:'([^']+)'|([A-Za-z0-9_]+))!)?(\$?)([A-Za-z]+):(\$?)([A-Za-z]+)$/;
const WHOLE_ROW_REGEX = /^(?:(?:'([^']+)'|([A-Za-z0-9_]+))!)?(\$?)([0-9]+):(\$?)([0-9]+)$/;

/**
 * Parses an A1-style cell reference string (e.g. "A1", "$B$5", "Sheet1!C3").
 */
export function parseCellRef(refStr: string): CellCoord {
  const match = CELL_REGEX.exec(refStr.trim());
  if (!match) {
    throw TrellisError.refError(`Malformed cell coordinate reference: ${refStr}`);
  }

  const sheet = match[1] || match[2] || undefined;
  const colFixed = match[3] === "$";
  const col = colToIndex(match[4]!);
  const rowFixed = match[5] === "$";
  const row = parseInt(match[6]!, 10) - 1;

  if (row < 0 || row >= MAX_ROWS || col < 0 || col >= MAX_COLS) {
    throw TrellisError.refError(`Cell reference coordinates exceed grid limits: ${refStr}`);
  }

  return { row, col, rowFixed, colFixed, sheet };
}

/**
 * Parses a range reference string (e.g. "A1:B10", "Sheet2!$C$4:$E$20", "A:C", "1:10").
 */
export function parseRangeRef(rangeStr: string): RangeCoord {
  const trimmed = rangeStr.trim();

  // Standard rectangular range A1:B10
  const match = RANGE_REGEX.exec(trimmed);
  if (match) {
    const sheet = match[1] || match[2] || undefined;
    const startColFixed = match[3] === "$";
    const startCol = colToIndex(match[4]!);
    const startRowFixed = match[5] === "$";
    const startRow = parseInt(match[6]!, 10) - 1;

    const endColFixed = match[7] === "$";
    const endCol = colToIndex(match[8]!);
    const endRowFixed = match[9] === "$";
    const endRow = parseInt(match[10]!, 10) - 1;

    const normStartRow = Math.min(startRow, endRow);
    const normEndRow = Math.max(startRow, endRow);
    const normStartCol = Math.min(startCol, endCol);
    const normEndCol = Math.max(startCol, endCol);

    return {
      startRow: normStartRow,
      startCol: normStartCol,
      endRow: normEndRow,
      endCol: normEndCol,
      startRowFixed,
      startColFixed,
      endRowFixed,
      endColFixed,
      sheet
    };
  }

  // Whole-column range A:B
  const colMatch = WHOLE_COL_REGEX.exec(trimmed);
  if (colMatch) {
    const sheet = colMatch[1] || colMatch[2] || undefined;
    const startColFixed = colMatch[3] === "$";
    const startCol = colToIndex(colMatch[4]!);
    const endColFixed = colMatch[5] === "$";
    const endCol = colToIndex(colMatch[6]!);

    return {
      startRow: 0,
      startCol: Math.min(startCol, endCol),
      endRow: MAX_ROWS - 1,
      endCol: Math.max(startCol, endCol),
      startRowFixed: true,
      startColFixed,
      endRowFixed: true,
      endColFixed,
      sheet
    };
  }

  // Whole-row range 1:5
  const rowMatch = WHOLE_ROW_REGEX.exec(trimmed);
  if (rowMatch) {
    const sheet = rowMatch[1] || rowMatch[2] || undefined;
    const startRowFixed = rowMatch[3] === "$";
    const startRow = parseInt(rowMatch[4]!, 10) - 1;
    const endRowFixed = rowMatch[5] === "$";
    const endRow = parseInt(rowMatch[6]!, 10) - 1;

    return {
      startRow: Math.min(startRow, endRow),
      startCol: 0,
      endRow: Math.max(startRow, endRow),
      endCol: MAX_COLS - 1,
      startRowFixed,
      startColFixed: true,
      endRowFixed,
      endColFixed: true,
      sheet
    };
  }

  // Single cell treated as 1x1 range
  try {
    const cell = parseCellRef(trimmed);
    return {
      startRow: cell.row,
      startCol: cell.col,
      endRow: cell.row,
      endCol: cell.col,
      startRowFixed: cell.rowFixed,
      startColFixed: cell.colFixed,
      endRowFixed: cell.rowFixed,
      endColFixed: cell.colFixed,
      sheet: cell.sheet
    };
  } catch {
    throw TrellisError.refError(`Invalid range reference format: ${rangeStr}`);
  }
}

/**
 * Formats a CellCoord into its canonical A1 representation.
 */
export function formatCellRef(coord: CellCoord): string {
  const sheetPart = coord.sheet
    ? coord.sheet.includes(" ")
      ? `'${coord.sheet}'!`
      : `${coord.sheet}!`
    : "";
  const colPart = (coord.colFixed ? "$" : "") + indexToCol(coord.col);
  const rowPart = (coord.rowFixed ? "$" : "") + (coord.row + 1);
  return `${sheetPart}${colPart}${rowPart}`;
}

/**
 * Formats a RangeCoord into its canonical A1 range representation.
 */
export function formatRangeRef(range: RangeCoord): string {
  const sheetPart = range.sheet
    ? range.sheet.includes(" ")
      ? `'${range.sheet}'!`
      : `${range.sheet}!`
    : "";

  if (range.startRow === 0 && range.endRow === MAX_ROWS - 1) {
    const startColPart = (range.startColFixed ? "$" : "") + indexToCol(range.startCol);
    const endColPart = (range.endColFixed ? "$" : "") + indexToCol(range.endCol);
    return `${sheetPart}${startColPart}:${endColPart}`;
  }

  if (range.startCol === 0 && range.endCol === MAX_COLS - 1) {
    const startRowPart = (range.startRowFixed ? "$" : "") + (range.startRow + 1);
    const endRowPart = (range.endRowFixed ? "$" : "") + (range.endRow + 1);
    return `${sheetPart}${startRowPart}:${endRowPart}`;
  }

  const startPart =
    (range.startColFixed ? "$" : "") +
    indexToCol(range.startCol) +
    (range.startRowFixed ? "$" : "") +
    (range.startRow + 1);
  const endPart =
    (range.endColFixed ? "$" : "") +
    indexToCol(range.endCol) +
    (range.endRowFixed ? "$" : "") +
    (range.endRow + 1);

  if (startPart === endPart) {
    return `${sheetPart}${startPart}`;
  }
  return `${sheetPart}${startPart}:${endPart}`;
}

/**
 * Checks whether two rectangular ranges intersect.
 */
export function rangesIntersect(r1: RangeCoord, r2: RangeCoord): boolean {
  if (r1.sheet && r2.sheet && r1.sheet !== r2.sheet) {
    return false;
  }
  return !(
    r1.endRow < r2.startRow ||
    r1.startRow > r2.endRow ||
    r1.endCol < r2.startCol ||
    r1.startCol > r2.endCol
  );
}

/**
 * Determines whether a parent range completely encompasses a target cell.
 */
export function rangeContainsCell(range: RangeCoord, cell: CellCoord): boolean {
  if (range.sheet && cell.sheet && range.sheet !== cell.sheet) {
    return false;
  }
  return (
    cell.row >= range.startRow &&
    cell.row <= range.endRow &&
    cell.col >= range.startCol &&
    cell.col <= range.endCol
  );
}

/**
 * Determines whether a parent range completely encompasses a sub-range.
 */
export function rangeContains(parent: RangeCoord, child: RangeCoord): boolean {
  if (parent.sheet && child.sheet && parent.sheet !== child.sheet) {
    return false;
  }
  return (
    child.startRow >= parent.startRow &&
    child.endRow <= parent.endRow &&
    child.startCol >= parent.startCol &&
    child.endCol <= parent.endCol
  );
}

/**
 * Computes the union bounding box covering two ranges.
 */
export function rangeUnion(r1: RangeCoord, r2: RangeCoord): RangeCoord {
  return {
    startRow: Math.min(r1.startRow, r2.startRow),
    startCol: Math.min(r1.startCol, r2.startCol),
    endRow: Math.max(r1.endRow, r2.endRow),
    endCol: Math.max(r1.endCol, r2.endCol),
    sheet: r1.sheet || r2.sheet
  };
}

/**
 * Returns total number of individual cells covered by a range.
 */
export function rangeCellCount(range: RangeCoord): number {
  const rows = range.endRow - range.startRow + 1;
  const cols = range.endCol - range.startCol + 1;
  return rows * cols;
}
