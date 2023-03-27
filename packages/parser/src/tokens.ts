/**
 * Token definitions and lexical categories for formula parsing.
 */

export enum TokenType {
  // Literals
  NUMBER = "NUMBER",
  STRING = "STRING",
  BOOLEAN = "BOOLEAN",
  ERROR = "ERROR",

  // Identifiers and Keywords
  IDENTIFIER = "IDENTIFIER",
  LAMBDA = "LAMBDA",
  LET = "LET",

  // Cell and Range References
  CELL_REF = "CELL_REF",
  RANGE_REF = "RANGE_REF",
  STRUCTURED_REF = "STRUCTURED_REF",

  // Arithmetic and Binary Operators
  PLUS = "PLUS",
  MINUS = "MINUS",
  STAR = "STAR",
  SLASH = "SLASH",
  CARET = "CARET",
  AMPERSAND = "AMPERSAND",
  PERCENT = "PERCENT",
  HASH = "HASH",

  // Comparison Operators
  EQUAL = "EQUAL",
  NOT_EQUAL = "NOT_EQUAL",
  LESS_THAN = "LESS_THAN",
  LESS_THAN_OR_EQUAL = "LESS_THAN_OR_EQUAL",
  GREATER_THAN = "GREATER_THAN",
  GREATER_THAN_OR_EQUAL = "GREATER_THAN_OR_EQUAL",

  // Delimiters and Punctuation
  LPAREN = "LPAREN",
  RPAREN = "RPAREN",
  LBRACKET = "LBRACKET",
  RBRACKET = "RBRACKET",
  LBRACE = "LBRACE",
  RBRACE = "RBRACE",
  COMMA = "COMMA",
  COLON = "COLON",
  SEMICOLON = "SEMICOLON",
  SPACE = "SPACE",
  EXCLAMATION = "EXCLAMATION",

  // Control
  EOF = "EOF"
}

export interface Token {
  readonly type: TokenType;
  readonly value: string;
  readonly raw: string;
  readonly start: number;
  readonly end: number;
  readonly line: number;
  readonly col: number;
}
