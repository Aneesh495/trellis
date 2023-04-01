/**
 * Function registry, metadata definitions, arity validation, and argument unpackers.
 */

import { CellValue, PrimitiveValue, TMatrix, TrellisError, coerceToNumber } from "@trellis/core";
import { EvaluationContext } from "@trellis/runtime";

export type FunctionCategory =
  | "math"
  | "stats"
  | "finance"
  | "logical"
  | "text"
  | "datetime"
  | "lookup"
  | "array"
  | "info";

export type FunctionImpl = (args: CellValue[], ctx: EvaluationContext) => CellValue;

export interface FunctionMetadata {
  readonly name: string;
  readonly category: FunctionCategory;
  readonly minArgs: number;
  readonly maxArgs: number;
  readonly isVolatile?: boolean;
  readonly description: string;
  readonly fn: FunctionImpl;
}

export class FunctionRegistry {
  private static instance: FunctionRegistry;
  private readonly registry: Map<string, FunctionMetadata> = new Map();

  public static getInstance(): FunctionRegistry {
    if (!FunctionRegistry.instance) {
      FunctionRegistry.instance = new FunctionRegistry();
    }
    return FunctionRegistry.instance;
  }

  public register(meta: FunctionMetadata): void {
    this.registry.set(meta.name.toUpperCase(), meta);
  }

  public get(name: string): FunctionMetadata | undefined {
    return this.registry.get(name.toUpperCase());
  }

  public has(name: string): boolean {
    return this.registry.has(name.toUpperCase());
  }

  public call(name: string, args: CellValue[], ctx: EvaluationContext): CellValue {
    const meta = this.get(name);
    if (!meta) {
      throw TrellisError.nameError(`Unknown function '${name}'`);
    }

    if (args.length < meta.minArgs) {
      throw TrellisError.valueError(
        `Function '${meta.name}' requires at least ${meta.minArgs} argument(s), but received ${args.length}`
      );
    }

    if (meta.maxArgs !== -1 && args.length > meta.maxArgs) {
      throw TrellisError.valueError(
        `Function '${meta.name}' accepts at most ${meta.maxArgs} argument(s), but received ${args.length}`
      );
    }

    return meta.fn(args, ctx);
  }

  public list(): FunctionMetadata[] {
    return Array.from(this.registry.values());
  }

  public listByCategory(category: FunctionCategory): FunctionMetadata[] {
    return this.list().filter((m) => m.category === category);
  }
}

/**
 * Recursively flattens arguments and matrices into a list of numbers, ignoring blanks and text where appropriate.
 */
export function flattenNumericArgs(args: CellValue[], strictErrors = true): number[] {
  const result: number[] = [];

  for (const arg of args) {
    if (arg === null || arg === undefined) continue;

    if (TrellisError.isError(arg)) {
      if (strictErrors) throw arg;
      continue;
    }

    if (arg instanceof TMatrix) {
      for (const val of arg.flatten()) {
        if (val === null || val === undefined || typeof val === "string" || typeof val === "boolean") {
          continue; // Excel skips text and booleans inside ranges for SUM/AVERAGE
        }
        if (TrellisError.isError(val)) {
          if (strictErrors) throw val;
          continue;
        }
        result.push(coerceToNumber(val));
      }
    } else if (typeof arg === "number") {
      result.push(arg);
    } else if (typeof arg === "string" || typeof arg === "boolean") {
      // Explicit scalar arguments get coerced
      result.push(coerceToNumber(arg));
    } else if (arg instanceof Date) {
      result.push(coerceToNumber(arg));
    }
  }

  return result;
}

/**
 * Flattens all arguments and matrices into an array of primitive values.
 */
export function flattenAllArgs(args: CellValue[]): PrimitiveValue[] {
  const result: PrimitiveValue[] = [];
  for (const arg of args) {
    if (arg instanceof TMatrix) {
      for (const val of arg.flatten()) {
        result.push(val);
      }
    } else {
      result.push(arg);
    }
  }
  return result;
}
