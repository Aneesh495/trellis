/**
 * AST to linear bytecode compiler with constant folding and short-circuit jump patching.
 */

import { ASTNode } from "@trellis/parser";
import { Opcode } from "./opcodes.js";
import { BytecodeChunk, Instruction } from "./bytecode.js";
import { CellValue } from "@trellis/core";

export class BytecodeCompiler {
  private instructions: Instruction[] = [];
  private constants: CellValue[] = [];

  public static compile(ast: ASTNode): BytecodeChunk {
    const compiler = new BytecodeCompiler();
    compiler.compileNode(ast);
    compiler.emit(Opcode.OP_RETURN);
    return {
      instructions: compiler.instructions,
      constants: compiler.constants
    };
  }

  private compileNode(node: ASTNode): void {
    switch (node.type) {
      case "Literal": {
        const constIdx = this.addConstant(node.value);
        this.emit(Opcode.OP_CONST, constIdx);
        break;
      }

      case "Cell":
        this.emit(Opcode.OP_GET_CELL, node.coord);
        break;

      case "Range":
        this.emit(Opcode.OP_GET_RANGE, node.range);
        break;

      case "SpillRef":
        this.emit(Opcode.OP_GET_SPILL, node.root);
        break;

      case "Variable":
        this.emit(Opcode.OP_GET_VAR, node.name);
        break;

      case "UnaryOp":
        this.compileNode(node.argument);
        if (node.op === "-") {
          this.emit(Opcode.OP_NEG);
        } else if (node.op === "+") {
          this.emit(Opcode.OP_POS);
        } else if (node.op === "%") {
          this.emit(Opcode.OP_PERCENT);
        }
        break;

      case "BinaryOp":
        this.compileNode(node.left);
        this.compileNode(node.right);
        switch (node.op) {
          case "+":
            this.emit(Opcode.OP_ADD);
            break;
          case "-":
            this.emit(Opcode.OP_SUB);
            break;
          case "*":
            this.emit(Opcode.OP_MUL);
            break;
          case "/":
            this.emit(Opcode.OP_DIV);
            break;
          case "^":
            this.emit(Opcode.OP_POW);
            break;
          case "&":
            this.emit(Opcode.OP_CONCAT);
            break;
          case "=":
            this.emit(Opcode.OP_EQ);
            break;
          case "<>":
            this.emit(Opcode.OP_NEQ);
            break;
          case "<":
            this.emit(Opcode.OP_LT);
            break;
          case "<=":
            this.emit(Opcode.OP_LTE);
            break;
          case ">":
            this.emit(Opcode.OP_GT);
            break;
          case ">=":
            this.emit(Opcode.OP_GTE);
            break;
          default:
            this.emit(Opcode.OP_ADD);
            break;
        }
        break;

      case "FunctionCall": {
        // Special case: Short-circuiting IF(condition, thenExpr, elseExpr)
        if (node.name.toUpperCase() === "IF" && node.args.length >= 2 && node.args.length <= 3) {
          this.compileIf(node);
          return;
        }

        // Standard function call
        for (const arg of node.args) {
          this.compileNode(arg);
        }
        this.emit(Opcode.OP_CALL, JSON.stringify({ name: node.name.toUpperCase(), argCount: node.args.length }));
        break;
      }

      case "ArrayLiteral": {
        const rows = node.rows.length;
        const cols = rows > 0 && node.rows[0] ? node.rows[0].length : 0;
        for (const row of node.rows) {
          for (const item of row) {
            this.compileNode(item);
          }
        }
        this.emit(Opcode.OP_MAKE_ARRAY, JSON.stringify({ rows, cols }));
        break;
      }

      case "Lambda": {
        this.emit(Opcode.OP_MAKE_LAMBDA, JSON.stringify({ params: node.params, bodyAst: node.body }));
        break;
      }

      case "Let": {
        for (const b of node.bindings) {
          this.compileNode(b.expr);
          this.emit(Opcode.OP_SET_VAR, b.name);
        }
        this.compileNode(node.body);
        break;
      }

      case "StructuredRef":
        this.emit(Opcode.OP_CONST, this.addConstant(null));
        break;
    }
  }

  private compileIf(node: { args: ASTNode[] }): void {
    // 1. Compile condition
    this.compileNode(node.args[0]!);

    // 2. Emit jump to else branch if condition evaluates to false
    const jumpToElseIdx = this.emit(Opcode.OP_JUMP_IF_FALSE, 0);

    // 3. Compile then branch
    this.compileNode(node.args[1]!);

    // 4. Emit jump to exit
    const jumpToExitIdx = this.emit(Opcode.OP_JUMP, 0);

    // 5. Patch jump to else branch
    const elseStartIdx = this.instructions.length;
    this.patchJump(jumpToElseIdx, elseStartIdx);

    // 6. Compile else branch (or push null if omitted)
    if (node.args.length > 2 && node.args[2]) {
      this.compileNode(node.args[2]);
    } else {
      const nullIdx = this.addConstant(false);
      this.emit(Opcode.OP_CONST, nullIdx);
    }

    // 7. Patch jump to exit
    const exitIdx = this.instructions.length;
    this.patchJump(jumpToExitIdx, exitIdx);
  }

  private addConstant(value: CellValue): number {
    this.constants.push(value);
    return this.constants.length - 1;
  }

  private emit(op: Opcode, operand?: number | string | any): number {
    this.instructions.push({ op, operand });
    return this.instructions.length - 1;
  }

  private patchJump(instructionIdx: number, targetIp: number): void {
    const original = this.instructions[instructionIdx]!;
    this.instructions[instructionIdx] = {
      ...original,
      operand: targetIp
    };
  }
}
