/**
 * Bytecode Virtual Machine opcodes for linear formula execution.
 */

export enum Opcode {
  // Constant and Variable Operations
  OP_CONST = 1,
  OP_GET_CELL = 2,
  OP_GET_RANGE = 3,
  OP_GET_SPILL = 4,
  OP_GET_VAR = 5,
  OP_SET_VAR = 6,

  // Arithmetic Operations
  OP_ADD = 10,
  OP_SUB = 11,
  OP_MUL = 12,
  OP_DIV = 13,
  OP_POW = 14,
  OP_CONCAT = 15,

  // Comparison Operations
  OP_EQ = 20,
  OP_NEQ = 21,
  OP_LT = 22,
  OP_LTE = 23,
  OP_GT = 24,
  OP_GTE = 25,

  // Unary Operations
  OP_NEG = 30,
  OP_POS = 31,
  OP_PERCENT = 32,

  // Flow Control and Branching
  OP_JUMP = 40,
  OP_JUMP_IF_FALSE = 41,
  OP_JUMP_IF_TRUE = 42,

  // Function and Array Dispatch
  OP_CALL = 50,
  OP_MAKE_ARRAY = 51,
  OP_MAKE_LAMBDA = 52,
  OP_INVOKE_LAMBDA = 53,

  // Stack Management
  OP_POP = 60,
  OP_DUP = 61,
  OP_RETURN = 62
}
