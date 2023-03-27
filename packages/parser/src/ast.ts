/**
 * Strongly typed Abstract Syntax Tree (AST) definitions for Trellis formulas.
 */

import { CellCoord, RangeCoord, PrimitiveValue } from "@trellis/core";

export type BinaryOp =
  | "+"
  | "-"
  | "*"
  | "/"
  | "^"
  | "&"
  | "="
  | "<>"
  | "<"
  | "<="
  | ">"
  | ">="
  | ":"
  | " "; // intersection

export type UnaryOp = "+" | "-" | "%" | "#";

export interface BaseNode {
  readonly start?: number;
  readonly end?: number;
}

export interface LiteralNode extends BaseNode {
  readonly type: "Literal";
  readonly value: PrimitiveValue;
  readonly raw: string;
}

export interface CellNode extends BaseNode {
  readonly type: "Cell";
  readonly coord: CellCoord;
  readonly raw: string;
}

export interface RangeNode extends BaseNode {
  readonly type: "Range";
  readonly range: RangeCoord;
  readonly raw: string;
}

export interface SpillRefNode extends BaseNode {
  readonly type: "SpillRef";
  readonly root: CellCoord;
  readonly raw: string;
}

export interface BinaryOpNode extends BaseNode {
  readonly type: "BinaryOp";
  readonly op: BinaryOp;
  readonly left: ASTNode;
  readonly right: ASTNode;
}

export interface UnaryOpNode extends BaseNode {
  readonly type: "UnaryOp";
  readonly op: UnaryOp;
  readonly argument: ASTNode;
  readonly isPrefix: boolean;
}

export interface FunctionCallNode extends BaseNode {
  readonly type: "FunctionCall";
  readonly name: string;
  readonly args: ASTNode[];
}

export interface ArrayLiteralNode extends BaseNode {
  readonly type: "ArrayLiteral";
  readonly rows: ASTNode[][];
}

export interface LambdaNode extends BaseNode {
  readonly type: "Lambda";
  readonly params: string[];
  readonly body: ASTNode;
}

export interface LetNode extends BaseNode {
  readonly type: "Let";
  readonly bindings: Array<{ name: string; expr: ASTNode }>;
  readonly body: ASTNode;
}

export interface VariableNode extends BaseNode {
  readonly type: "Variable";
  readonly name: string;
}

export interface StructuredRefNode extends BaseNode {
  readonly type: "StructuredRef";
  readonly raw: string;
}

export type ASTNode =
  | LiteralNode
  | CellNode
  | RangeNode
  | SpillRefNode
  | BinaryOpNode
  | UnaryOpNode
  | FunctionCallNode
  | ArrayLiteralNode
  | LambdaNode
  | LetNode
  | VariableNode
  | StructuredRefNode;

/**
 * Traverses an AST tree depth-first, invoking callback on each node.
 */
export function walkAST(node: ASTNode, callback: (n: ASTNode) => void): void {
  callback(node);
  switch (node.type) {
    case "BinaryOp":
      walkAST(node.left, callback);
      walkAST(node.right, callback);
      break;
    case "UnaryOp":
      walkAST(node.argument, callback);
      break;
    case "FunctionCall":
      for (const arg of node.args) {
        walkAST(arg, callback);
      }
      break;
    case "ArrayLiteral":
      for (const row of node.rows) {
        for (const item of row) {
          walkAST(item, callback);
        }
      }
      break;
    case "Lambda":
      walkAST(node.body, callback);
      break;
    case "Let":
      for (const b of node.bindings) {
        walkAST(b.expr, callback);
      }
      walkAST(node.body, callback);
      break;
    case "Literal":
    case "Cell":
    case "Range":
    case "SpillRef":
    case "Variable":
    case "StructuredRef":
      break;
  }
}
