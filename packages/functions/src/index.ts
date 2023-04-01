/**
 * Standard Library module entrypoint for Trellis.
 */

import { FunctionRegistry } from "./registry.js";
import { registerMathFunctions } from "./math.js";
import { registerStatsFunctions } from "./stats.js";
import { registerFinanceFunctions } from "./finance.js";
import { registerLogicalFunctions } from "./logical.js";
import { registerTextFunctions } from "./text.js";
import { registerDateTimeFunctions } from "./datetime.js";
import { registerLookupFunctions } from "./lookup.js";
import { registerArrayFunctions } from "./array.js";
import { registerInfoFunctions } from "./info.js";

export * from "./registry.js";
export * from "./math.js";
export * from "./stats.js";
export * from "./finance.js";
export * from "./logical.js";
export * from "./text.js";
export * from "./datetime.js";
export * from "./lookup.js";
export * from "./array.js";
export * from "./info.js";

/**
 * Initializes and registers all built-in standard library functions.
 */
export function initializeStandardLibrary(reg: FunctionRegistry = FunctionRegistry.getInstance()): FunctionRegistry {
  registerMathFunctions(reg);
  registerStatsFunctions(reg);
  registerFinanceFunctions(reg);
  registerLogicalFunctions(reg);
  registerTextFunctions(reg);
  registerDateTimeFunctions(reg);
  registerLookupFunctions(reg);
  registerArrayFunctions(reg);
  registerInfoFunctions(reg);
  return reg;
}

// Auto-initialize default singleton registry
initializeStandardLibrary();
