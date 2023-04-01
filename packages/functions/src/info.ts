/**
 * Type reflection, cell inspection, and error diagnostics.
 */

import { FunctionRegistry } from "./registry.js";
import { TMatrix, TrellisError, ErrorCode } from "@trellis/core";

export function registerInfoFunctions(reg: FunctionRegistry): void {
  // ISBLANK
  reg.register({
    name: "ISBLANK",
    category: "info",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns TRUE if cell value is empty or blank",
    fn: (args) => {
      const v = args[0]!;
      return v === null || v === undefined || v === "";
    }
  });

  // ISNUMBER
  reg.register({
    name: "ISNUMBER",
    category: "info",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns TRUE if value is a number",
    fn: (args) => typeof args[0]! === "number" && !isNaN(args[0]! as number)
  });

  // ISTEXT
  reg.register({
    name: "ISTEXT",
    category: "info",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns TRUE if value is a text string",
    fn: (args) => typeof args[0]! === "string"
  });

  // ISERROR
  reg.register({
    name: "ISERROR",
    category: "info",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns TRUE if value is any calculation error",
    fn: (args) => TrellisError.isError(args[0]!)
  });

  // ISLOGICAL
  reg.register({
    name: "ISLOGICAL",
    category: "info",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns TRUE if value is a boolean TRUE or FALSE",
    fn: (args) => typeof args[0]! === "boolean"
  });

  // ISNONTEXT
  reg.register({
    name: "ISNONTEXT",
    category: "info",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns TRUE if value is not text (including blanks and numbers)",
    fn: (args) => typeof args[0]! !== "string"
  });

  // TYPE
  reg.register({
    name: "TYPE",
    category: "info",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns integer representing the data type: 1=Number, 2=Text, 4=Logical, 16=Error, 64=Array",
    fn: (args) => {
      const v = args[0]!;
      if (v instanceof TMatrix) return 64;
      if (TrellisError.isError(v)) return 16;
      if (typeof v === "boolean") return 4;
      if (typeof v === "string") return 2;
      if (typeof v === "number" || v instanceof Date) return 1;
      return 1;
    }
  });

  // NA
  reg.register({
    name: "NA",
    category: "info",
    minArgs: 0,
    maxArgs: 0,
    description: "Returns the error value #N/A",
    fn: () => TrellisError.naError()
  });

  // ERROR.TYPE
  reg.register({
    name: "ERROR.TYPE",
    category: "info",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns a number corresponding to an error type",
    fn: (args) => {
      const v = args[0]!;
      if (!TrellisError.isError(v)) throw TrellisError.naError();
      switch (v.code) {
        case ErrorCode.NULL:
          return 1;
        case ErrorCode.DIV_ZERO:
          return 2;
        case ErrorCode.VALUE:
          return 3;
        case ErrorCode.REF:
          return 4;
        case ErrorCode.NAME:
          return 5;
        case ErrorCode.NUM:
          return 6;
        case ErrorCode.NA:
          return 7;
        default:
          return 8;
      }
    }
  });
}
