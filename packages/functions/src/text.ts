/**
 * String manipulation, regex pattern extraction, formatting, and unicode codecs.
 */

import { FunctionRegistry, flattenAllArgs } from "./registry.js";
import { TMatrix, TrellisError, coerceToString, coerceToNumber, PrimitiveValue } from "@trellis/core";

export function registerTextFunctions(reg: FunctionRegistry): void {
  // CONCAT
  reg.register({
    name: "CONCAT",
    category: "text",
    minArgs: 1,
    maxArgs: -1,
    description: "Combines text from multiple ranges and strings",
    fn: (args) => {
      let result = "";
      for (const v of flattenAllArgs(args)) {
        if (v !== null && v !== undefined) {
          result += coerceToString(v);
        }
      }
      return result;
    }
  });

  // CONCATENATE
  reg.register({
    name: "CONCATENATE",
    category: "text",
    minArgs: 1,
    maxArgs: -1,
    description: "Joins several text strings into one string",
    fn: (args) => reg.call("CONCAT", args, {} as any)
  });

  // TEXTJOIN
  reg.register({
    name: "TEXTJOIN",
    category: "text",
    minArgs: 3,
    maxArgs: -1,
    description: "Combines the text from multiple ranges and strings with a delimiter",
    fn: (args) => {
      const delimiter = coerceToString(args[0]!);
      const ignoreEmpty = Boolean(args[1]);
      const items: string[] = [];

      for (const v of flattenAllArgs(args.slice(2))) {
        if (v === null || v === undefined || v === "") {
          if (!ignoreEmpty) items.push("");
        } else {
          items.push(coerceToString(v));
        }
      }
      return items.join(delimiter);
    }
  });

  // LEFT
  reg.register({
    name: "LEFT",
    category: "text",
    minArgs: 1,
    maxArgs: 2,
    description: "Returns specified number of characters from start of text",
    fn: (args) => {
      const str = coerceToString(args[0]!);
      const num = args.length > 1 ? Math.trunc(coerceToNumber(args[1]!)) : 1;
      if (num < 0) throw TrellisError.valueError();
      return str.slice(0, num);
    }
  });

  // RIGHT
  reg.register({
    name: "RIGHT",
    category: "text",
    minArgs: 1,
    maxArgs: 2,
    description: "Returns specified number of characters from end of text",
    fn: (args) => {
      const str = coerceToString(args[0]!);
      const num = args.length > 1 ? Math.trunc(coerceToNumber(args[1]!)) : 1;
      if (num < 0) throw TrellisError.valueError();
      if (num === 0) return "";
      return str.slice(-num);
    }
  });

  // MID
  reg.register({
    name: "MID",
    category: "text",
    minArgs: 3,
    maxArgs: 3,
    description: "Returns characters from middle of text string given start position and length",
    fn: (args) => {
      const str = coerceToString(args[0]!);
      const start = Math.trunc(coerceToNumber(args[1]!));
      const len = Math.trunc(coerceToNumber(args[2]!));
      if (start < 1 || len < 0) throw TrellisError.valueError();
      return str.slice(start - 1, start - 1 + len);
    }
  });

  // LEN
  reg.register({
    name: "LEN",
    category: "text",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns the number of characters in a text string",
    fn: (args) => coerceToString(args[0]!).length
  });

  // FIND (case-sensitive)
  reg.register({
    name: "FIND",
    category: "text",
    minArgs: 2,
    maxArgs: 3,
    description: "Finds text within another string (case-sensitive)",
    fn: (args) => {
      const findText = coerceToString(args[0]!);
      const withinText = coerceToString(args[1]!);
      const start = args.length > 2 ? Math.trunc(coerceToNumber(args[2]!)) : 1;
      if (start < 1 || start > withinText.length + 1) throw TrellisError.valueError();

      const idx = withinText.indexOf(findText, start - 1);
      if (idx === -1) throw TrellisError.valueError("FIND substring not found");
      return idx + 1; // 1-based index
    }
  });

  // SEARCH (case-insensitive)
  reg.register({
    name: "SEARCH",
    category: "text",
    minArgs: 2,
    maxArgs: 3,
    description: "Finds text within another string (case-insensitive)",
    fn: (args) => {
      const findText = coerceToString(args[0]!).toUpperCase();
      const withinText = coerceToString(args[1]!).toUpperCase();
      const start = args.length > 2 ? Math.trunc(coerceToNumber(args[2]!)) : 1;
      if (start < 1 || start > withinText.length + 1) throw TrellisError.valueError();

      const idx = withinText.indexOf(findText, start - 1);
      if (idx === -1) throw TrellisError.valueError("SEARCH substring not found");
      return idx + 1;
    }
  });

  // REPLACE
  reg.register({
    name: "REPLACE",
    category: "text",
    minArgs: 4,
    maxArgs: 4,
    description: "Replaces part of a text string with a different text string",
    fn: (args) => {
      const oldText = coerceToString(args[0]!);
      const start = Math.trunc(coerceToNumber(args[1]!));
      const numChars = Math.trunc(coerceToNumber(args[2]!));
      const newText = coerceToString(args[3]!);
      if (start < 1 || numChars < 0) throw TrellisError.valueError();
      const prefix = oldText.slice(0, start - 1);
      const suffix = oldText.slice(start - 1 + numChars);
      return prefix + newText + suffix;
    }
  });

  // SUBSTITUTE
  reg.register({
    name: "SUBSTITUTE",
    category: "text",
    minArgs: 3,
    maxArgs: 4,
    description: "Substitutes new text for old text in a string",
    fn: (args) => {
      const text = coerceToString(args[0]!);
      const oldText = coerceToString(args[1]!);
      const newText = coerceToString(args[2]!);
      if (oldText === "") return text;

      if (args.length > 3) {
        const instance = Math.trunc(coerceToNumber(args[3]!));
        if (instance < 1) throw TrellisError.valueError();
        let matchCount = 0;
        let pos = 0;
        while ((pos = text.indexOf(oldText, pos)) !== -1) {
          matchCount++;
          if (matchCount === instance) {
            return text.slice(0, pos) + newText + text.slice(pos + oldText.length);
          }
          pos += oldText.length;
        }
        return text;
      }

      return text.replaceAll(oldText, newText);
    }
  });

  // LOWER, UPPER, PROPER, TRIM, CLEAN, EXACT
  reg.register({
    name: "LOWER",
    category: "text",
    minArgs: 1,
    maxArgs: 1,
    description: "Converts text to lowercase",
    fn: (args) => coerceToString(args[0]!).toLowerCase()
  });

  reg.register({
    name: "UPPER",
    category: "text",
    minArgs: 1,
    maxArgs: 1,
    description: "Converts text to uppercase",
    fn: (args) => coerceToString(args[0]!).toUpperCase()
  });

  reg.register({
    name: "PROPER",
    category: "text",
    minArgs: 1,
    maxArgs: 1,
    description: "Capitalizes the first letter in each word of a text value",
    fn: (args) => {
      const str = coerceToString(args[0]!);
      return str.replace(/\b\w/g, (char) => char.toUpperCase());
    }
  });

  reg.register({
    name: "TRIM",
    category: "text",
    minArgs: 1,
    maxArgs: 1,
    description: "Removes extra spaces from text leaving single spaces between words",
    fn: (args) => coerceToString(args[0]!).trim().replace(/\s+/g, " ")
  });

  reg.register({
    name: "CLEAN",
    category: "text",
    minArgs: 1,
    maxArgs: 1,
    description: "Removes all non-printable characters from text",
    fn: (args) => coerceToString(args[0]!).replace(/[\x00-\x1F\x7F]/g, "")
  });

  reg.register({
    name: "EXACT",
    category: "text",
    minArgs: 2,
    maxArgs: 2,
    description: "Checks whether two text values are identical (case-sensitive)",
    fn: (args) => coerceToString(args[0]!) === coerceToString(args[1]!)
  });

  // SPLIT
  reg.register({
    name: "SPLIT",
    category: "text",
    minArgs: 2,
    maxArgs: 2,
    description: "Splits text around a specified delimiter into an array row",
    fn: (args) => {
      const text = coerceToString(args[0]!);
      const delimiter = coerceToString(args[1]!);
      const parts = text.split(delimiter);
      return TMatrix.rowVector(parts);
    }
  });

  // REGEXEXTRACT, REGEXREPLACE, REGEXMATCH
  reg.register({
    name: "REGEXEXTRACT",
    category: "text",
    minArgs: 2,
    maxArgs: 2,
    description: "Extracts matching substrings using regular expression",
    fn: (args) => {
      const text = coerceToString(args[0]!);
      const pattern = coerceToString(args[1]!);
      const regex = new RegExp(pattern);
      const match = regex.exec(text);
      if (!match) throw TrellisError.naError("Regex pattern did not match text");
      if (match.length > 2) {
        return TMatrix.rowVector(match.slice(1));
      }
      if (match.length === 2) {
        return match[1]!;
      }
      return match[0]!;
    }
  });

  reg.register({
    name: "REGEXREPLACE",
    category: "text",
    minArgs: 3,
    maxArgs: 3,
    description: "Replaces text matching regular expression with replacement string",
    fn: (args) => {
      const text = coerceToString(args[0]!);
      const pattern = coerceToString(args[1]!);
      const replacement = coerceToString(args[2]!);
      const regex = new RegExp(pattern, "g");
      return text.replace(regex, replacement);
    }
  });

  reg.register({
    name: "REGEXMATCH",
    category: "text",
    minArgs: 2,
    maxArgs: 2,
    description: "Tests whether text matches a regular expression",
    fn: (args) => {
      const text = coerceToString(args[0]!);
      const pattern = coerceToString(args[1]!);
      const regex = new RegExp(pattern);
      return regex.test(text);
    }
  });

  // REPT, CHAR, CODE
  reg.register({
    name: "REPT",
    category: "text",
    minArgs: 2,
    maxArgs: 2,
    description: "Repeats text a given number of times",
    fn: (args) => {
      const text = coerceToString(args[0]!);
      const count = Math.trunc(coerceToNumber(args[1]!));
      if (count < 0) throw TrellisError.valueError();
      return text.repeat(count);
    }
  });

  reg.register({
    name: "CHAR",
    category: "text",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns the character specified by the code number",
    fn: (args) => {
      const code = Math.trunc(coerceToNumber(args[0]!));
      if (code < 1 || code > 65535) throw TrellisError.valueError();
      return String.fromCharCode(code);
    }
  });

  reg.register({
    name: "CODE",
    category: "text",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns a numeric code for the first character in a text string",
    fn: (args) => {
      const text = coerceToString(args[0]!);
      if (text.length === 0) throw TrellisError.valueError();
      return text.charCodeAt(0);
    }
  });

  // TEXTSPLIT: Splits text into rows and columns using delimiters
  reg.register({
    name: "TEXTSPLIT",
    category: "text",
    minArgs: 2,
    maxArgs: 3,
    description: "Splits text strings by using column and row delimiters",
    fn: (args) => {
      const text = coerceToString(args[0]!);
      const colDelim = args[1] !== null && args[1] !== undefined ? coerceToString(args[1]) : "";
      const rowDelim = args.length > 2 && args[2] !== null && args[2] !== undefined ? coerceToString(args[2]) : "";

      if (rowDelim.length > 0) {
        const rawRows = text.split(rowDelim);
        const matrixData: PrimitiveValue[][] = [];
        let maxCols = 0;

        for (const r of rawRows) {
          const cols = colDelim.length > 0 ? r.split(colDelim) : [r];
          matrixData.push(cols);
          if (cols.length > maxCols) maxCols = cols.length;
        }

        // Pad uneven rows
        for (const row of matrixData) {
          while (row.length < maxCols) {
            row.push("");
          }
        }

        return new TMatrix(matrixData);
      }

      if (colDelim.length > 0) {
        const cols = text.split(colDelim);
        return TMatrix.rowVector(cols);
      }

      return TMatrix.scalar(text);
    }
  });

  // TEXTBEFORE: Returns text that occurs before a given delimiter
  reg.register({
    name: "TEXTBEFORE",
    category: "text",
    minArgs: 2,
    maxArgs: 3,
    description: "Returns text that occurs before a given delimiter",
    fn: (args) => {
      const text = coerceToString(args[0]!);
      const delim = coerceToString(args[1]!);
      const instance = args.length > 2 ? Math.trunc(coerceToNumber(args[2]!)) : 1;

      if (delim.length === 0) throw TrellisError.valueError();
      const indices: number[] = [];
      let pos = 0;

      while ((pos = text.indexOf(delim, pos)) !== -1) {
        indices.push(pos);
        pos += delim.length;
      }

      if (indices.length === 0) throw TrellisError.naError();

      let targetIdx: number;
      if (instance > 0) {
        if (instance > indices.length) throw TrellisError.naError();
        targetIdx = indices[instance - 1]!;
      } else if (instance < 0) {
        const revIdx = indices.length + instance;
        if (revIdx < 0) throw TrellisError.naError();
        targetIdx = indices[revIdx]!;
      } else {
        throw TrellisError.valueError();
      }

      return text.substring(0, targetIdx);
    }
  });

  // TEXTAFTER: Returns text that occurs after a given delimiter
  reg.register({
    name: "TEXTAFTER",
    category: "text",
    minArgs: 2,
    maxArgs: 3,
    description: "Returns text that occurs after a given delimiter",
    fn: (args) => {
      const text = coerceToString(args[0]!);
      const delim = coerceToString(args[1]!);
      const instance = args.length > 2 ? Math.trunc(coerceToNumber(args[2]!)) : 1;

      if (delim.length === 0) throw TrellisError.valueError();
      const indices: number[] = [];
      let pos = 0;

      while ((pos = text.indexOf(delim, pos)) !== -1) {
        indices.push(pos);
        pos += delim.length;
      }

      if (indices.length === 0) throw TrellisError.naError();

      let targetIdx: number;
      if (instance > 0) {
        if (instance > indices.length) throw TrellisError.naError();
        targetIdx = indices[instance - 1]!;
      } else if (instance < 0) {
        const revIdx = indices.length + instance;
        if (revIdx < 0) throw TrellisError.naError();
        targetIdx = indices[revIdx]!;
      } else {
        throw TrellisError.valueError();
      }

      return text.substring(targetIdx + delim.length);
    }
  });

  // VALUETOTEXT: Formats value to text
  reg.register({
    name: "VALUETOTEXT",
    category: "text",
    minArgs: 1,
    maxArgs: 2,
    description: "Returns text from any value formatted as concise or strict",
    fn: (args) => {
      const val = args[0]!;
      const strict = args.length > 1 ? coerceToNumber(args[1]!) === 1 : false;

      if (val === null || val === undefined) return "";
      if (typeof val === "string") {
        return strict ? `"${val}"` : val;
      }
      return coerceToString(val);
    }
  });

  // ARRAYTOTEXT: Formats array into text representation
  reg.register({
    name: "ARRAYTOTEXT",
    category: "text",
    minArgs: 1,
    maxArgs: 2,
    description: "Returns a text representation of any array of values",
    fn: (args) => {
      const val = args[0]!;
      const strict = args.length > 1 ? coerceToNumber(args[1]!) === 1 : false;
      const matrix = val instanceof TMatrix ? val : TMatrix.scalar(val as PrimitiveValue);

      const rows: string[] = [];
      for (let r = 0; r < matrix.rowCount; r++) {
        const cols: string[] = [];
        for (let c = 0; c < matrix.colCount; c++) {
          const item = matrix.get(r, c);
          if (strict && typeof item === "string") {
            cols.push(`"${item}"`);
          } else {
            cols.push(item === null ? "" : coerceToString(item));
          }
        }
        rows.push(cols.join(strict ? ", " : ", "));
      }

      if (strict) {
        return "{" + rows.join("; ") + "}";
      }
      return rows.join(", ");
    }
  });
}
