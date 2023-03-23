/**
 * Canonical spreadsheet error representations and runtime error containers.
 */

export enum ErrorCode {
  NULL = "#NULL!",
  DIV_ZERO = "#DIV/0!",
  VALUE = "#VALUE!",
  REF = "#REF!",
  NAME = "#NAME?",
  NUM = "#NUM!",
  NA = "#N/A",
  SPILL = "#SPILL!",
  CIRCULAR = "#CIRCULAR!",
  BLOCKED = "#BLOCKED!",
  CALC = "#CALC!"
}

/**
 * TrellisError represents a first-class calculation error value in cell state.
 */
export class TrellisError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: string;
  public readonly sourceCoord?: string;

  constructor(code: ErrorCode, details?: string, sourceCoord?: string) {
    const fullMsg = details ? `${code}: ${details}` : code;
    super(fullMsg);
    this.name = "TrellisError";
    this.code = code;
    this.details = details;
    this.sourceCoord = sourceCoord;
    Object.setPrototypeOf(this, TrellisError.prototype);
  }

  /**
   * Factory constructors for canonical errors.
   */
  public static nullError(msg = "Intersection of two ranges does not intersect", coord?: string): TrellisError {
    return new TrellisError(ErrorCode.NULL, msg, coord);
  }

  public static divZero(msg = "Division by zero", coord?: string): TrellisError {
    return new TrellisError(ErrorCode.DIV_ZERO, msg, coord);
  }

  public static valueError(msg = "A value used in the formula is of the wrong data type", coord?: string): TrellisError {
    return new TrellisError(ErrorCode.VALUE, msg, coord);
  }

  public static refError(msg = "Invalid cell reference", coord?: string): TrellisError {
    return new TrellisError(ErrorCode.REF, msg, coord);
  }

  public static nameError(msg = "Formula contains unrecognized text or function name", coord?: string): TrellisError {
    return new TrellisError(ErrorCode.NAME, msg, coord);
  }

  public static numError(msg = "Formula or function contains invalid numeric values", coord?: string): TrellisError {
    return new TrellisError(ErrorCode.NUM, msg, coord);
  }

  public static naError(msg = "Value not available", coord?: string): TrellisError {
    return new TrellisError(ErrorCode.NA, msg, coord);
  }

  public static spillError(msg = "Spill range is not blank or intersects existing values", coord?: string): TrellisError {
    return new TrellisError(ErrorCode.SPILL, msg, coord);
  }

  public static circularError(msg = "Circular dependency chain detected in formula graph", coord?: string): TrellisError {
    return new TrellisError(ErrorCode.CIRCULAR, msg, coord);
  }

  public static calcError(msg = "Calculation engine encountered an unsupported operation", coord?: string): TrellisError {
    return new TrellisError(ErrorCode.CALC, msg, coord);
  }

  /**
   * Identifies whether an arbitrary value is a TrellisError.
   */
  public static isError(val: unknown): val is TrellisError {
    return val instanceof TrellisError || (typeof val === "object" && val !== null && "code" in val && Object.values(ErrorCode).includes((val as any).code));
  }

  /**
   * Matches string literals to corresponding ErrorCode.
   */
  public static fromString(str: string): TrellisError | null {
    const trimmed = str.trim().toUpperCase();
    for (const code of Object.values(ErrorCode)) {
      if (trimmed === code) {
        return new TrellisError(code);
      }
    }
    return null;
  }
}
