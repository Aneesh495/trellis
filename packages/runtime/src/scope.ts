/**
 * Lexical scoping environment and closure capture container.
 */

import { CellValue, TrellisError } from "@trellis/core";
import { ASTNode } from "@trellis/parser";

export class ScopeEnvironment {
  private readonly variables: Map<string, CellValue> = new Map();
  public readonly parent?: ScopeEnvironment;

  constructor(parent?: ScopeEnvironment) {
    this.parent = parent;
  }

  /**
   * Binds a value to a variable identifier in current scope.
   */
  public bind(name: string, value: CellValue): void {
    this.variables.set(name.toUpperCase(), value);
  }

  /**
   * Resolves a variable name walking up lexical scope ancestors.
   */
  public lookup(name: string): CellValue {
    const key = name.toUpperCase();
    if (this.variables.has(key)) {
      return this.variables.get(key)!;
    }
    if (this.parent) {
      return this.parent.lookup(name);
    }
    throw TrellisError.nameError(`Variable '${name}' is not defined in current scope`);
  }

  /**
   * Creates a nested child scope referencing this as parent.
   */
  public child(): ScopeEnvironment {
    return new ScopeEnvironment(this);
  }
}

/**
 * First-class Lambda closure encapsulating parameter names, body AST, and lexical environment.
 */
export class LambdaClosure {
  public readonly params: string[];
  public readonly body: ASTNode;
  public readonly closureScope: ScopeEnvironment;

  constructor(params: string[], body: ASTNode, closureScope: ScopeEnvironment) {
    this.params = params;
    this.body = body;
    this.closureScope = closureScope;
  }
}
