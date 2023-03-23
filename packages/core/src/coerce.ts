/**
 * Type coercion rules, date-serial arithmetic, and polymorphic value comparison.
 */

import { CellValue, TMatrix } from "./types.js";
import { TrellisError } from "./errors.js";

/**
 * Days between Unix epoch (Jan 1, 1970) and Excel epoch (Dec 30, 1899).
 */
const EXCEL_EPOCH_OFFSET_DAYS = 25569;
const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * Coerces a cell value to an IEEE-754 floating-point number.
 */
export function coerceToNumber(value: CellValue): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "number") {
    if (isNaN(value)) throw TrellisError.numError("Encountered NaN numeric value");
    return value;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return 0;

    // Handle percentage
    if (trimmed.endsWith("%")) {
      const numPart = trimmed.slice(0, -1).trim();
      const num = Number(numPart);
      if (isNaN(num)) throw TrellisError.valueError(`Cannot coerce percentage string "${value}" to number`);
      return num / 100;
    }

    // Handle currency symbols ($ or € or £)
    const sanitized = trimmed.replace(/^[$€£]/, "").replace(/,/g, "").trim();
    const parsed = Number(sanitized);
    if (!isNaN(parsed)) {
      return parsed;
    }

    // Try parsing date string
    const dateParsed = Date.parse(trimmed);
    if (!isNaN(dateParsed)) {
      return dateToSerial(new Date(dateParsed));
    }

    throw TrellisError.valueError(`Cannot coerce string "${value}" to numeric value`);
  }
  if (value instanceof Date) {
    return dateToSerial(value);
  }
  if (TrellisError.isError(value)) {
    throw value;
  }
  if (value instanceof TMatrix) {
    const first = value.get(0, 0);
    return coerceToNumber(first);
  }
  throw TrellisError.valueError(`Unsupported type for numeric coercion`);
}

/**
 * Coerces a cell value to a string representation.
 */
export function coerceToString(value: CellValue): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : (value > 0 ? "Infinity" : "-Infinity");
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (TrellisError.isError(value)) {
    return value.code;
  }
  if (value instanceof TMatrix) {
    const first = value.get(0, 0);
    return coerceToString(first);
  }
  return String(value);
}

/**
 * Coerces a cell value to a boolean flag.
 */
export function coerceToBoolean(value: CellValue): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const upper = value.trim().toUpperCase();
    if (upper === "TRUE") return true;
    if (upper === "FALSE") return false;
    const num = Number(upper);
    if (!isNaN(num)) return num !== 0;
    throw TrellisError.valueError(`Cannot coerce string "${value}" to boolean`);
  }
  if (TrellisError.isError(value)) {
    throw value;
  }
  if (value instanceof TMatrix) {
    const first = value.get(0, 0);
    return coerceToBoolean(first);
  }
  return Boolean(value);
}

/**
 * Coerces a cell value to a JavaScript Date object.
 */
export function coerceToDate(value: CellValue): Date {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "number") {
    return serialToDate(value);
  }
  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    if (!isNaN(timestamp)) {
      return new Date(timestamp);
    }
    const num = Number(value);
    if (!isNaN(num)) {
      return serialToDate(num);
    }
    throw TrellisError.valueError(`Cannot coerce string "${value}" to Date`);
  }
  if (TrellisError.isError(value)) {
    throw value;
  }
  if (value instanceof TMatrix) {
    const first = value.get(0, 0);
    return coerceToDate(first);
  }
  throw TrellisError.valueError(`Cannot coerce value to Date`);
}

/**
 * Converts a Date object into an Excel serial day number.
 */
export function dateToSerial(date: Date): number {
  const utcMillis = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds()
  );
  let serial = utcMillis / MILLISECONDS_PER_DAY + EXCEL_EPOCH_OFFSET_DAYS;
  // Historical 1900 leap year bug compensation (day 60 = 1900-02-29)
  if (serial > 60) {
    serial += 1;
  }
  return serial;
}

/**
 * Converts an Excel serial day number into a JavaScript Date object.
 */
export function serialToDate(serial: number): Date {
  let adjustedSerial = serial;
  if (adjustedSerial > 60) {
    adjustedSerial -= 1;
  }
  const utcMillis = Math.round((adjustedSerial - EXCEL_EPOCH_OFFSET_DAYS) * MILLISECONDS_PER_DAY);
  return new Date(utcMillis);
}

/**
 * Type precedence index for sorting and relational comparison:
 * Null < Numbers < Strings < Booleans < Errors
 */
function getTypeOrder(val: CellValue): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return 1;
  if (val instanceof Date) return 1;
  if (typeof val === "string") return 2;
  if (typeof val === "boolean") return 3;
  if (TrellisError.isError(val)) return 4;
  return 5;
}

/**
 * Compares two arbitrary cell values according to strict spreadsheet type ordering.
 * Returns negative if a < b, 0 if equal, positive if a > b.
 */
export function compareValues(a: CellValue, b: CellValue): number {
  if (a instanceof TMatrix) a = a.get(0, 0);
  if (b instanceof TMatrix) b = b.get(0, 0);

  const orderA = getTypeOrder(a);
  const orderB = getTypeOrder(b);
  if (orderA !== orderB) {
    return orderA - orderB;
  }

  // Same type comparisons
  if (a === null || a === undefined) return 0;

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }

  if (typeof a === "string" && typeof b === "string") {
    return a.localeCompare(b, undefined, { sensitivity: "accent" });
  }

  if (typeof a === "boolean" && typeof b === "boolean") {
    return (a ? 1 : 0) - (b ? 1 : 0);
  }

  if (TrellisError.isError(a) && TrellisError.isError(b)) {
    return a.code.localeCompare(b.code);
  }

  return 0;
}

/**
 * Tests loose equality between two cell values.
 */
export function valuesEqual(a: CellValue, b: CellValue): boolean {
  return compareValues(a, b) === 0;
}
