/**
 * Boolean logic, condition branching, and error handling functions.
 */

import { FunctionRegistry } from "./registry.js";
import { TrellisError, ErrorCode, coerceToBoolean, coerceToNumber, compareValues } from "@trellis/core";

export function registerLogicalFunctions(reg: FunctionRegistry): void {
  // IF
  reg.register({
    name: "IF",
    category: "logical",
    minArgs: 2,
    maxArgs: 3,
    description: "Returns one value if condition is TRUE and another if FALSE",
    fn: (args) => {
      const cond = coerceToBoolean(args[0]!);
      if (cond) {
        return args[1] ?? null;
      }
      return args.length > 2 ? args[2] ?? null : false;
    }
  });

  // IFS
  reg.register({
    name: "IFS",
    category: "logical",
    minArgs: 2,
    maxArgs: -1,
    description: "Evaluates multiple condition pairs in order and returns first matching value",
    fn: (args) => {
      if (args.length % 2 !== 0) {
        throw TrellisError.valueError("IFS expects an even number of arguments (condition/value pairs)");
      }
      for (let i = 0; i < args.length; i += 2) {
        if (coerceToBoolean(args[i]!)) {
          return args[i + 1] ?? null;
        }
      }
      throw TrellisError.naError("None of the IFS conditions evaluated to TRUE");
    }
  });

  // AND
  reg.register({
    name: "AND",
    category: "logical",
    minArgs: 1,
    maxArgs: -1,
    description: "Returns TRUE if all arguments evaluate to TRUE",
    fn: (args) => {
      for (const arg of args) {
        if (TrellisError.isError(arg)) throw arg;
        if (!coerceToBoolean(arg)) return false;
      }
      return true;
    }
  });

  // OR
  reg.register({
    name: "OR",
    category: "logical",
    minArgs: 1,
    maxArgs: -1,
    description: "Returns TRUE if any argument evaluates to TRUE",
    fn: (args) => {
      for (const arg of args) {
        if (TrellisError.isError(arg)) throw arg;
        if (coerceToBoolean(arg)) return true;
      }
      return false;
    }
  });

  // XOR
  reg.register({
    name: "XOR",
    category: "logical",
    minArgs: 1,
    maxArgs: -1,
    description: "Logical exclusive OR: returns TRUE if an odd number of arguments evaluate to TRUE",
    fn: (args) => {
      let trueCount = 0;
      for (const arg of args) {
        if (TrellisError.isError(arg)) throw arg;
        if (coerceToBoolean(arg)) trueCount++;
      }
      return trueCount % 2 === 1;
    }
  });

  // NOT
  reg.register({
    name: "NOT",
    category: "logical",
    minArgs: 1,
    maxArgs: 1,
    description: "Reverses the logical value of its argument",
    fn: (args) => !coerceToBoolean(args[0]!)
  });

  // SWITCH
  reg.register({
    name: "SWITCH",
    category: "logical",
    minArgs: 3,
    maxArgs: -1,
    description: "Evaluates target expression against list of values and returns corresponding result",
    fn: (args) => {
      const target = args[0]!;
      const pairsCount = Math.floor((args.length - 1) / 2);
      const hasDefault = (args.length - 1) % 2 === 1;

      for (let p = 0; p < pairsCount; p++) {
        const matchVal = args[1 + p * 2]!;
        const resultVal = args[2 + p * 2]!;
        if (compareValues(target, matchVal) === 0) {
          return resultVal;
        }
      }

      if (hasDefault) {
        return args[args.length - 1]!;
      }
      throw TrellisError.naError("No matching case found in SWITCH");
    }
  });

  // CHOOSE
  reg.register({
    name: "CHOOSE",
    category: "logical",
    minArgs: 2,
    maxArgs: -1,
    description: "Chooses a value from a list of arguments based on 1-based index",
    fn: (args) => {
      const idx = Math.trunc(coerceToNumber(args[0]!));
      if (idx < 1 || idx >= args.length) {
        throw TrellisError.valueError(`CHOOSE index ${idx} is out of bounds (1 to ${args.length - 1})`);
      }
      return args[idx]!;
    }
  });

  // IFERROR
  reg.register({
    name: "IFERROR",
    category: "logical",
    minArgs: 2,
    maxArgs: 2,
    description: "Returns fallback value if expression evaluates to an error, otherwise returns expression",
    fn: (args) => {
      const val = args[0]!;
      if (TrellisError.isError(val)) {
        return args[1]!;
      }
      return val;
    }
  });

  // IFNA
  reg.register({
    name: "IFNA",
    category: "logical",
    minArgs: 2,
    maxArgs: 2,
    description: "Returns fallback value if expression evaluates to #N/A, otherwise returns expression",
    fn: (args) => {
      const val = args[0]!;
      if (TrellisError.isError(val) && val.code === ErrorCode.NA) {
        return args[1]!;
      }
      return val;
    }
  });
}
