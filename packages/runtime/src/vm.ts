/**
 * High-performance stack-based Virtual Machine executing compiled bytecode chunks.
 */

import { Opcode } from "./opcodes.js";
import { BytecodeChunk } from "./bytecode.js";
import { EvaluationContext } from "./context.js";
import { ScopeEnvironment, LambdaClosure } from "./scope.js";
import {
  CellValue,
  PrimitiveValue,
  CellCoord,
  RangeCoord,
  TMatrix,
  TrellisError,
  coerceToNumber,
  coerceToString,
  coerceToBoolean,
  compareValues
} from "@trellis/core";
import { BytecodeCompiler } from "./compiler.js";

export class VirtualMachine {
  private readonly stack: CellValue[] = [];
  private ip = 0;
  private readonly maxSteps = 1_000_000;
  private stepCount = 0;

  public static evaluate(chunk: BytecodeChunk, ctx: EvaluationContext, scope?: ScopeEnvironment): CellValue {
    const vm = new VirtualMachine();
    return vm.run(chunk, ctx, scope || new ScopeEnvironment());
  }

  public run(chunk: BytecodeChunk, ctx: EvaluationContext, initialScope: ScopeEnvironment): CellValue {
    this.stack.length = 0;
    this.ip = 0;
    this.stepCount = 0;
    let scope = initialScope;

    const instructions = chunk.instructions;
    const constants = chunk.constants;
    const len = instructions.length;

    while (this.ip < len) {
      if (++this.stepCount > this.maxSteps) {
        throw TrellisError.calcError("Maximum execution step count exceeded in formula VM");
      }

      const inst = instructions[this.ip++]!;
      switch (inst.op) {
        case Opcode.OP_CONST:
          this.stack.push(constants[inst.operand as number] ?? null);
          break;

        case Opcode.OP_GET_CELL: {
          const coord = inst.operand as CellCoord;
          this.stack.push(ctx.getCellValue(coord));
          break;
        }

        case Opcode.OP_GET_RANGE: {
          const range = inst.operand as RangeCoord;
          this.stack.push(ctx.getRangeValues(range));
          break;
        }

        case Opcode.OP_GET_SPILL: {
          const root = inst.operand as CellCoord;
          this.stack.push(ctx.getSpillRange(root));
          break;
        }

        case Opcode.OP_GET_VAR: {
          const varName = inst.operand as string;
          this.stack.push(scope.lookup(varName));
          break;
        }

        case Opcode.OP_SET_VAR: {
          const varName = inst.operand as string;
          const val = this.pop();
          scope.bind(varName, val);
          break;
        }

        case Opcode.OP_ADD: {
          const b = this.pop();
          const a = this.pop();
          if (TrellisError.isError(a)) {
            this.stack.push(a);
          } else if (TrellisError.isError(b)) {
            this.stack.push(b);
          } else {
            try {
              const numA = coerceToNumber(a);
              const numB = coerceToNumber(b);
              this.stack.push(numA + numB);
            } catch (err) {
              this.stack.push(err instanceof TrellisError ? err : TrellisError.valueError());
            }
          }
          break;
        }

        case Opcode.OP_SUB: {
          const b = this.pop();
          const a = this.pop();
          if (TrellisError.isError(a)) {
            this.stack.push(a);
          } else if (TrellisError.isError(b)) {
            this.stack.push(b);
          } else {
            try {
              const numA = coerceToNumber(a);
              const numB = coerceToNumber(b);
              this.stack.push(numA - numB);
            } catch (err) {
              this.stack.push(err instanceof TrellisError ? err : TrellisError.valueError());
            }
          }
          break;
        }

        case Opcode.OP_MUL: {
          const b = this.pop();
          const a = this.pop();
          if (TrellisError.isError(a)) {
            this.stack.push(a);
          } else if (TrellisError.isError(b)) {
            this.stack.push(b);
          } else {
            try {
              const numA = coerceToNumber(a);
              const numB = coerceToNumber(b);
              this.stack.push(numA * numB);
            } catch (err) {
              this.stack.push(err instanceof TrellisError ? err : TrellisError.valueError());
            }
          }
          break;
        }

        case Opcode.OP_DIV: {
          const b = this.pop();
          const a = this.pop();
          if (TrellisError.isError(a)) {
            this.stack.push(a);
          } else if (TrellisError.isError(b)) {
            this.stack.push(b);
          } else {
            try {
              const numA = coerceToNumber(a);
              const numB = coerceToNumber(b);
              if (numB === 0) {
                this.stack.push(TrellisError.divZero());
              } else {
                this.stack.push(numA / numB);
              }
            } catch (err) {
              this.stack.push(err instanceof TrellisError ? err : TrellisError.valueError());
            }
          }
          break;
        }

        case Opcode.OP_POW: {
          const b = this.pop();
          const a = this.pop();
          if (TrellisError.isError(a)) {
            this.stack.push(a);
          } else if (TrellisError.isError(b)) {
            this.stack.push(b);
          } else {
            try {
              const numA = coerceToNumber(a);
              const numB = coerceToNumber(b);
              const result = Math.pow(numA, numB);
              if (isNaN(result)) {
                this.stack.push(TrellisError.numError());
              } else {
                this.stack.push(result);
              }
            } catch (err) {
              this.stack.push(err instanceof TrellisError ? err : TrellisError.valueError());
            }
          }
          break;
        }

        case Opcode.OP_CONCAT: {
          const b = this.pop();
          const a = this.pop();
          if (TrellisError.isError(a)) {
            this.stack.push(a);
          } else if (TrellisError.isError(b)) {
            this.stack.push(b);
          } else {
            const strA = coerceToString(a);
            const strB = coerceToString(b);
            this.stack.push(strA + strB);
          }
          break;
        }

        case Opcode.OP_EQ: {
          const b = this.pop();
          const a = this.pop();
          this.stack.push(compareValues(a, b) === 0);
          break;
        }

        case Opcode.OP_NEQ: {
          const b = this.pop();
          const a = this.pop();
          this.stack.push(compareValues(a, b) !== 0);
          break;
        }

        case Opcode.OP_LT: {
          const b = this.pop();
          const a = this.pop();
          this.stack.push(compareValues(a, b) < 0);
          break;
        }

        case Opcode.OP_LTE: {
          const b = this.pop();
          const a = this.pop();
          this.stack.push(compareValues(a, b) <= 0);
          break;
        }

        case Opcode.OP_GT: {
          const b = this.pop();
          const a = this.pop();
          this.stack.push(compareValues(a, b) > 0);
          break;
        }

        case Opcode.OP_GTE: {
          const b = this.pop();
          const a = this.pop();
          this.stack.push(compareValues(a, b) >= 0);
          break;
        }

        case Opcode.OP_NEG: {
          const a = this.pop();
          if (TrellisError.isError(a)) {
            this.stack.push(a);
          } else {
            try {
              this.stack.push(-coerceToNumber(a));
            } catch (err) {
              this.stack.push(err instanceof TrellisError ? err : TrellisError.valueError());
            }
          }
          break;
        }

        case Opcode.OP_POS: {
          const a = this.pop();
          if (TrellisError.isError(a)) {
            this.stack.push(a);
          } else {
            try {
              this.stack.push(+coerceToNumber(a));
            } catch (err) {
              this.stack.push(err instanceof TrellisError ? err : TrellisError.valueError());
            }
          }
          break;
        }

        case Opcode.OP_PERCENT: {
          const a = this.pop();
          if (TrellisError.isError(a)) {
            this.stack.push(a);
          } else {
            try {
              this.stack.push(coerceToNumber(a) / 100);
            } catch (err) {
              this.stack.push(err instanceof TrellisError ? err : TrellisError.valueError());
            }
          }
          break;
        }

        case Opcode.OP_JUMP:
          this.ip = inst.operand as number;
          break;

        case Opcode.OP_JUMP_IF_FALSE: {
          const condition = this.pop();
          if (TrellisError.isError(condition)) {
            this.stack.push(condition);
            return condition;
          }
          const boolVal = coerceToBoolean(condition);
          if (!boolVal) {
            this.ip = inst.operand as number;
          }
          break;
        }

        case Opcode.OP_JUMP_IF_TRUE: {
          const condition = this.pop();
          if (TrellisError.isError(condition)) {
            this.stack.push(condition);
            return condition;
          }
          const boolVal = coerceToBoolean(condition);
          if (boolVal) {
            this.ip = inst.operand as number;
          }
          break;
        }

        case Opcode.OP_CALL: {
          const meta = JSON.parse(inst.operand as string) as { name: string; argCount: number };
          const args: CellValue[] = [];
          for (let i = 0; i < meta.argCount; i++) {
            args.unshift(this.pop());
          }

          if (ctx.callFunction) {
            try {
              const res = ctx.callFunction(meta.name, args, ctx);
              this.stack.push(res);
            } catch (err) {
              this.stack.push(err instanceof TrellisError ? err : TrellisError.valueError(String(err)));
            }
          } else {
            throw TrellisError.nameError(`Evaluation context does not provide callFunction dispatcher`);
          }
          break;
        }

        case Opcode.OP_MAKE_ARRAY: {
          const { rows, cols } = JSON.parse(inst.operand as string) as { rows: number; cols: number };
          const matrixData: PrimitiveValue[][] = [];
          for (let r = rows - 1; r >= 0; r--) {
            const rowArr: PrimitiveValue[] = [];
            for (let c = cols - 1; c >= 0; c--) {
              rowArr.unshift(this.pop() as PrimitiveValue);
            }
            matrixData.unshift(rowArr);
          }
          this.stack.push(new TMatrix(matrixData));
          break;
        }

        case Opcode.OP_MAKE_LAMBDA: {
          const { params, bodyAst } = JSON.parse(inst.operand as string) as { params: string[]; bodyAst: any };
          this.stack.push(new LambdaClosure(params, bodyAst, scope.child()) as any);
          break;
        }

        case Opcode.OP_INVOKE_LAMBDA: {
          const closure = this.pop() as unknown as LambdaClosure;
          const argCount = inst.operand as number;
          const args: CellValue[] = [];
          for (let i = 0; i < argCount; i++) {
            args.unshift(this.pop());
          }

          const callScope = closure.closureScope.child();
          for (let i = 0; i < closure.params.length; i++) {
            callScope.bind(closure.params[i]!, args[i] ?? null);
          }

          const lambdaChunk = BytecodeCompiler.compile(closure.body);
          const lambdaResult = VirtualMachine.evaluate(lambdaChunk, ctx, callScope);
          this.stack.push(lambdaResult);
          break;
        }

        case Opcode.OP_POP:
          this.pop();
          break;

        case Opcode.OP_DUP: {
          const val = this.peek();
          this.stack.push(val);
          break;
        }

        case Opcode.OP_RETURN:
          return this.pop();
      }
    }

    return this.pop();
  }

  private pop(): CellValue {
    if (this.stack.length === 0) {
      return null;
    }
    return this.stack.pop()!;
  }

  private peek(): CellValue {
    if (this.stack.length === 0) {
      return null;
    }
    return this.stack[this.stack.length - 1]!;
  }
}

/**
 * Invokes a first-class LambdaClosure with the supplied arguments.
 */
export function invokeClosure(
  closure: LambdaClosure,
  args: CellValue[],
  ctx: EvaluationContext
): CellValue {
  const callScope = closure.closureScope.child();
  for (let i = 0; i < closure.params.length; i++) {
    callScope.bind(closure.params[i]!, args[i] ?? null);
  }
  const chunk = BytecodeCompiler.compile(closure.body);
  return VirtualMachine.evaluate(chunk, ctx, callScope);
}
