/**
 * Formula autocompletion engine providing contextual function signatures and argument hints.
 */

import { FunctionRegistry, FunctionMetadata } from "@trellis/functions";
import { Workbook } from "@trellis/storage";

export interface CompletionItem {
  readonly type: "function" | "named_range";
  readonly name: string;
  readonly signature: string;
  readonly description: string;
  readonly category?: string;
}

export interface ActiveSignatureHint {
  readonly functionName: string;
  readonly activeArgumentIndex: number;
  readonly signature: string;
  readonly description: string;
}

export class AutocompleteEngine {
  private readonly registry: FunctionRegistry;

  constructor(registry: FunctionRegistry = FunctionRegistry.getInstance()) {
    this.registry = registry;
  }

  /**
   * Suggests functions and named ranges matching the partial text prefix at the cursor.
   */
  public getCompletions(
    formula: string,
    cursorIndex: number,
    workbook?: Workbook
  ): CompletionItem[] {
    const prefix = this.extractIdentifierPrefix(formula, cursorIndex);
    if (!prefix) return [];

    const upperPrefix = prefix.toUpperCase();
    const items: CompletionItem[] = [];

    // Match functions from registry
    for (const fn of this.registry.list()) {
      if (fn.name.startsWith(upperPrefix)) {
        items.push({
          type: "function",
          name: fn.name,
          signature: this.buildSignature(fn),
          description: fn.description,
          category: fn.category
        });
      }
    }

    // Match named ranges
    if (workbook) {
      for (const name of workbook.namedRanges.keys()) {
        if (name.toUpperCase().startsWith(upperPrefix)) {
          items.push({
            type: "named_range",
            name,
            signature: name,
            description: "Workbook Named Range"
          });
        }
      }
    }

    // Sort: exact matches first, then alphabetical
    items.sort((a, b) => {
      const aExact = a.name === upperPrefix ? -1 : 0;
      const bExact = b.name === upperPrefix ? -1 : 0;
      return aExact - bExact || a.name.localeCompare(b.name);
    });

    return items.slice(0, 10);
  }

  /**
   * Identifies if the cursor is currently inside a function call and determines the active argument index.
   */
  public getActiveSignatureHint(formula: string, cursorIndex: number): ActiveSignatureHint | null {
    const textBeforeCursor = formula.slice(0, cursorIndex);

    let parenDepth = 0;
    let lastOpenParenIdx = -1;
    let commaCount = 0;

    for (let i = textBeforeCursor.length - 1; i >= 0; i--) {
      const ch = textBeforeCursor[i];
      if (ch === ")") {
        parenDepth++;
      } else if (ch === "(") {
        if (parenDepth === 0) {
          lastOpenParenIdx = i;
          break;
        }
        parenDepth--;
      } else if (ch === "," && parenDepth === 0) {
        commaCount++;
      }
    }

    if (lastOpenParenIdx === -1) return null;

    // Extract function name preceding open parenthesis
    let fnNameEnd = lastOpenParenIdx;
    while (fnNameEnd > 0 && /\s/.test(textBeforeCursor[fnNameEnd - 1] || "")) {
      fnNameEnd--;
    }

    let fnNameStart = fnNameEnd;
    while (fnNameStart > 0 && /[A-Za-z0-9_.]/.test(textBeforeCursor[fnNameStart - 1] || "")) {
      fnNameStart--;
    }

    const fnName = textBeforeCursor.slice(fnNameStart, fnNameEnd).toUpperCase();
    const meta = this.registry.get(fnName);
    if (!meta) return null;

    return {
      functionName: meta.name,
      activeArgumentIndex: commaCount,
      signature: this.buildSignature(meta),
      description: meta.description
    };
  }

  private extractIdentifierPrefix(formula: string, cursorIndex: number): string {
    let start = cursorIndex;
    while (start > 0 && /[A-Za-z0-9_.]/.test(formula[start - 1] || "")) {
      start--;
    }
    return formula.slice(start, cursorIndex);
  }

  private buildSignature(fn: FunctionMetadata): string {
    if (fn.minArgs === 0 && fn.maxArgs === 0) {
      return `${fn.name}()`;
    }
    if (fn.maxArgs === -1) {
      return `${fn.name}(value1, [value2], ...)`;
    }
    const args: string[] = [];
    for (let i = 0; i < fn.minArgs; i++) {
      args.push(`arg${i + 1}`);
    }
    for (let i = fn.minArgs; i < fn.maxArgs; i++) {
      args.push(`[arg${i + 1}]`);
    }
    return `${fn.name}(${args.join(", ")})`;
  }
}
