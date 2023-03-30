/**
 * Bytecode container structure and disassembler formatter.
 */

import { Opcode } from "./opcodes.js";
import { CellValue, CellCoord, RangeCoord, formatCellRef, formatRangeRef } from "@trellis/core";

export interface Instruction {
  readonly op: Opcode;
  readonly operand?: number | string | CellCoord | RangeCoord;
  readonly line?: number;
}

export interface BytecodeChunk {
  readonly instructions: Instruction[];
  readonly constants: CellValue[];
}

/**
 * Disassembles a BytecodeChunk into a readable assembly string representation.
 */
export function disassembleChunk(chunk: BytecodeChunk, name = "Formula"): string {
  const lines: string[] = [`== Disassembly of ${name} ==`];

  for (let i = 0; i < chunk.instructions.length; i++) {
    const inst = chunk.instructions[i]!;
    const opName = Opcode[inst.op] || `UNKNOWN(${inst.op})`;
    const ipStr = String(i).padStart(4, "0");

    let operandStr = "";
    if (inst.operand !== undefined) {
      if (inst.op === Opcode.OP_CONST && typeof inst.operand === "number") {
        const val = chunk.constants[inst.operand];
        operandStr = `[idx:${inst.operand}] -> ${JSON.stringify(val)}`;
      } else if (inst.op === Opcode.OP_GET_CELL) {
        operandStr = formatCellRef(inst.operand as CellCoord);
      } else if (inst.op === Opcode.OP_GET_RANGE) {
        operandStr = formatRangeRef(inst.operand as RangeCoord);
      } else if (inst.op === Opcode.OP_GET_SPILL) {
        operandStr = `${formatCellRef(inst.operand as CellCoord)}#`;
      } else {
        operandStr = String(inst.operand);
      }
    }

    lines.push(`${ipStr}  ${opName.padEnd(18)} ${operandStr}`);
  }

  return lines.join("\n");
}
