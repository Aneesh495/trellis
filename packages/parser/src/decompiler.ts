/**
 * Decompiler and AST-to-formula serializer with formatting and bracket matching.
 */

import { ASTNode } from "./ast.js";
import { formatCellRef, formatRangeRef, coerceToString } from "@trellis/core";

export interface DecompileOptions {
  pretty?: boolean;
  indent?: number;
}

export function decompile(node: ASTNode, options: DecompileOptions = {}): string {
  switch (node.type) {
    case "Literal":
      if (typeof node.value === "string") {
        return `"${node.value.replace(/"/g, '""')}"`;
      }
      return coerceToString(node.value);

    case "Cell":
      return formatCellRef(node.coord);

    case "Range":
      return formatRangeRef(node.range);

    case "SpillRef":
      return `${formatCellRef(node.root)}#`;

    case "Variable":
      return node.name;

    case "StructuredRef":
      return node.raw;

    case "UnaryOp":
      if (node.isPrefix) {
        return `${node.op}${decompile(node.argument, options)}`;
      }
      return `${decompile(node.argument, options)}${node.op}`;

    case "BinaryOp": {
      const leftStr = decompile(node.left, options);
      const rightStr = decompile(node.right, options);
      return `${leftStr} ${node.op} ${rightStr}`;
    }

    case "FunctionCall": {
      const argsStr = node.args.map((arg) => decompile(arg, options)).join(", ");
      return `${node.name}(${argsStr})`;
    }

    case "ArrayLiteral": {
      const rowStrings = node.rows.map((row) =>
        row.map((item) => decompile(item, options)).join(", ")
      );
      return `{${rowStrings.join("; ")}}`;
    }

    case "Lambda": {
      const paramList = node.params.join(", ");
      const bodyStr = decompile(node.body, options);
      return `LAMBDA(${paramList ? `${paramList}, ` : ""}${bodyStr})`;
    }

    case "Let": {
      const parts: string[] = [];
      for (const b of node.bindings) {
        parts.push(b.name);
        parts.push(decompile(b.expr, options));
      }
      parts.push(decompile(node.body, options));
      return `LET(${parts.join(", ")})`;
    }
  }
}
