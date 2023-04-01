/**
 * Mathematical, trigonometric, matrix, and conditional arithmetic functions.
 */

import { FunctionRegistry, flattenNumericArgs } from "./registry.js";
import { CellValue, PrimitiveValue, TMatrix, TrellisError, coerceToNumber, compareValues } from "@trellis/core";

export function registerMathFunctions(reg: FunctionRegistry): void {
  // SUM
  reg.register({
    name: "SUM",
    category: "math",
    minArgs: 1,
    maxArgs: -1,
    description: "Calculates the sum of all numeric values across arguments and ranges",
    fn: (args) => {
      const nums = flattenNumericArgs(args);
      let sum = 0;
      for (let i = 0; i < nums.length; i++) {
        sum += nums[i]!;
      }
      return sum;
    }
  });

  // PRODUCT
  reg.register({
    name: "PRODUCT",
    category: "math",
    minArgs: 1,
    maxArgs: -1,
    description: "Multiplies all numeric values across arguments and ranges",
    fn: (args) => {
      const nums = flattenNumericArgs(args);
      if (nums.length === 0) return 0;
      let prod = 1;
      for (let i = 0; i < nums.length; i++) {
        prod *= nums[i]!;
      }
      return prod;
    }
  });

  // ABS
  reg.register({
    name: "ABS",
    category: "math",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns absolute value of a number",
    fn: (args) => Math.abs(coerceToNumber(args[0]!))
  });

  // ROUND
  reg.register({
    name: "ROUND",
    category: "math",
    minArgs: 2,
    maxArgs: 2,
    description: "Rounds a number to a specified number of decimal digits",
    fn: (args) => {
      const num = coerceToNumber(args[0]!);
      const digits = Math.trunc(coerceToNumber(args[1]!));
      const factor = Math.pow(10, digits);
      return Math.round(num * factor) / factor;
    }
  });

  // ROUNDUP
  reg.register({
    name: "ROUNDUP",
    category: "math",
    minArgs: 2,
    maxArgs: 2,
    description: "Rounds a number up, away from zero",
    fn: (args) => {
      const num = coerceToNumber(args[0]!);
      const digits = Math.trunc(coerceToNumber(args[1]!));
      const factor = Math.pow(10, digits);
      const sign = num >= 0 ? 1 : -1;
      return (sign * Math.ceil(Math.abs(num) * factor)) / factor;
    }
  });

  // ROUNDDOWN
  reg.register({
    name: "ROUNDDOWN",
    category: "math",
    minArgs: 2,
    maxArgs: 2,
    description: "Rounds a number down, toward zero",
    fn: (args) => {
      const num = coerceToNumber(args[0]!);
      const digits = Math.trunc(coerceToNumber(args[1]!));
      const factor = Math.pow(10, digits);
      const sign = num >= 0 ? 1 : -1;
      return (sign * Math.floor(Math.abs(num) * factor)) / factor;
    }
  });

  // CEILING
  reg.register({
    name: "CEILING",
    category: "math",
    minArgs: 1,
    maxArgs: 2,
    description: "Rounds a number up to the nearest multiple of significance",
    fn: (args) => {
      const num = coerceToNumber(args[0]!);
      const sig = args.length > 1 ? coerceToNumber(args[1]!) : 1;
      if (sig === 0) return 0;
      return Math.ceil(num / sig) * sig;
    }
  });

  // FLOOR
  reg.register({
    name: "FLOOR",
    category: "math",
    minArgs: 1,
    maxArgs: 2,
    description: "Rounds a number down to the nearest multiple of significance",
    fn: (args) => {
      const num = coerceToNumber(args[0]!);
      const sig = args.length > 1 ? coerceToNumber(args[1]!) : 1;
      if (sig === 0) return 0;
      return Math.floor(num / sig) * sig;
    }
  });

  // INT
  reg.register({
    name: "INT",
    category: "math",
    minArgs: 1,
    maxArgs: 1,
    description: "Rounds a number down to the nearest integer",
    fn: (args) => Math.floor(coerceToNumber(args[0]!))
  });

  // MOD
  reg.register({
    name: "MOD",
    category: "math",
    minArgs: 2,
    maxArgs: 2,
    description: "Returns the remainder after division",
    fn: (args) => {
      const n = coerceToNumber(args[0]!);
      const d = coerceToNumber(args[1]!);
      if (d === 0) throw TrellisError.divZero();
      return ((n % d) + d) % d;
    }
  });

  // SQRT
  reg.register({
    name: "SQRT",
    category: "math",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns positive square root",
    fn: (args) => {
      const val = coerceToNumber(args[0]!);
      if (val < 0) throw TrellisError.numError("Square root of negative number");
      return Math.sqrt(val);
    }
  });

  // POWER
  reg.register({
    name: "POWER",
    category: "math",
    minArgs: 2,
    maxArgs: 2,
    description: "Calculates base raised to power exponent",
    fn: (args) => {
      const base = coerceToNumber(args[0]!);
      const exp = coerceToNumber(args[1]!);
      const res = Math.pow(base, exp);
      if (isNaN(res)) throw TrellisError.numError();
      return res;
    }
  });

  // EXP, LN, LOG, LOG10
  reg.register({
    name: "EXP",
    category: "math",
    minArgs: 1,
    maxArgs: 1,
    description: "Calculates e raised to power x",
    fn: (args) => Math.exp(coerceToNumber(args[0]!))
  });

  reg.register({
    name: "LN",
    category: "math",
    minArgs: 1,
    maxArgs: 1,
    description: "Calculates natural logarithm",
    fn: (args) => {
      const x = coerceToNumber(args[0]!);
      if (x <= 0) throw TrellisError.numError("Logarithm of non-positive number");
      return Math.log(x);
    }
  });

  reg.register({
    name: "LOG",
    category: "math",
    minArgs: 1,
    maxArgs: 2,
    description: "Calculates logarithm to given base (default 10)",
    fn: (args) => {
      const x = coerceToNumber(args[0]!);
      const base = args.length > 1 ? coerceToNumber(args[1]!) : 10;
      if (x <= 0 || base <= 0 || base === 1) throw TrellisError.numError();
      return Math.log(x) / Math.log(base);
    }
  });

  reg.register({
    name: "LOG10",
    category: "math",
    minArgs: 1,
    maxArgs: 1,
    description: "Calculates base-10 logarithm",
    fn: (args) => {
      const x = coerceToNumber(args[0]!);
      if (x <= 0) throw TrellisError.numError();
      return Math.log10(x);
    }
  });

  // Trigonometry: SIN, COS, TAN, ASIN, ACOS, ATAN, ATAN2, PI, DEGREES, RADIANS
  reg.register({
    name: "PI",
    category: "math",
    minArgs: 0,
    maxArgs: 0,
    description: "Returns mathematical constant Pi",
    fn: () => Math.PI
  });

  reg.register({
    name: "SIN",
    category: "math",
    minArgs: 1,
    maxArgs: 1,
    description: "Sine of angle in radians",
    fn: (args) => Math.sin(coerceToNumber(args[0]!))
  });

  reg.register({
    name: "COS",
    category: "math",
    minArgs: 1,
    maxArgs: 1,
    description: "Cosine of angle in radians",
    fn: (args) => Math.cos(coerceToNumber(args[0]!))
  });

  reg.register({
    name: "TAN",
    category: "math",
    minArgs: 1,
    maxArgs: 1,
    description: "Tangent of angle in radians",
    fn: (args) => Math.tan(coerceToNumber(args[0]!))
  });

  reg.register({
    name: "ASIN",
    category: "math",
    minArgs: 1,
    maxArgs: 1,
    description: "Arcsine in radians",
    fn: (args) => {
      const x = coerceToNumber(args[0]!);
      if (x < -1 || x > 1) throw TrellisError.numError();
      return Math.asin(x);
    }
  });

  reg.register({
    name: "ACOS",
    category: "math",
    minArgs: 1,
    maxArgs: 1,
    description: "Arccosine in radians",
    fn: (args) => {
      const x = coerceToNumber(args[0]!);
      if (x < -1 || x > 1) throw TrellisError.numError();
      return Math.acos(x);
    }
  });

  reg.register({
    name: "ATAN",
    category: "math",
    minArgs: 1,
    maxArgs: 1,
    description: "Arctangent in radians",
    fn: (args) => Math.atan(coerceToNumber(args[0]!))
  });

  reg.register({
    name: "ATAN2",
    category: "math",
    minArgs: 2,
    maxArgs: 2,
    description: "Arctangent of coordinates (x, y)",
    fn: (args) => {
      const x = coerceToNumber(args[0]!);
      const y = coerceToNumber(args[1]!);
      return Math.atan2(y, x);
    }
  });

  reg.register({
    name: "DEGREES",
    category: "math",
    minArgs: 1,
    maxArgs: 1,
    description: "Converts radians to degrees",
    fn: (args) => (coerceToNumber(args[0]!) * 180) / Math.PI
  });

  reg.register({
    name: "RADIANS",
    category: "math",
    minArgs: 1,
    maxArgs: 1,
    description: "Converts degrees to radians",
    fn: (args) => (coerceToNumber(args[0]!) * Math.PI) / 180
  });

  reg.register({
    name: "SIGN",
    category: "math",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns sign of number: -1, 0, or 1",
    fn: (args) => Math.sign(coerceToNumber(args[0]!))
  });

  // FACT, COMBIN
  reg.register({
    name: "FACT",
    category: "math",
    minArgs: 1,
    maxArgs: 1,
    description: "Factorial of an integer",
    fn: (args) => {
      const n = Math.trunc(coerceToNumber(args[0]!));
      if (n < 0 || n > 170) throw TrellisError.numError();
      let res = 1;
      for (let i = 2; i <= n; i++) res *= i;
      return res;
    }
  });

  reg.register({
    name: "COMBIN",
    category: "math",
    minArgs: 2,
    maxArgs: 2,
    description: "Number of combinations for given items",
    fn: (args) => {
      const n = Math.trunc(coerceToNumber(args[0]!));
      const k = Math.trunc(coerceToNumber(args[1]!));
      if (n < 0 || k < 0 || k > n) throw TrellisError.numError();
      if (k === 0 || k === n) return 1;
      let res = 1;
      for (let i = 1; i <= k; i++) {
        res = (res * (n - (k - i))) / i;
      }
      return Math.round(res);
    }
  });

  // SUMIF
  reg.register({
    name: "SUMIF",
    category: "math",
    minArgs: 2,
    maxArgs: 3,
    description: "Sums cells matching specified criterion",
    fn: (args) => {
      const rangeMat = toMatrix(args[0]!);
      const criterion = args[1]!;
      const sumMat = args.length > 2 ? toMatrix(args[2]!) : rangeMat;

      const flatRange = rangeMat.flatten();
      const flatSum = sumMat.flatten();
      let sum = 0;

      for (let i = 0; i < flatRange.length; i++) {
        const val = flatRange[i]!;
        if (matchesCriterion(val, criterion)) {
          const sumVal = flatSum[i];
          if (typeof sumVal === "number") {
            sum += sumVal;
          }
        }
      }
      return sum;
    }
  });

  // SUMIFS
  reg.register({
    name: "SUMIFS",
    category: "math",
    minArgs: 3,
    maxArgs: -1,
    description: "Sums cells matching multiple criteria sets",
    fn: (args) => {
      const sumMat = toMatrix(args[0]!);
      const flatSum = sumMat.flatten();
      const criteriaPairs: Array<{ items: PrimitiveValue[]; crit: CellValue }> = [];

      for (let i = 1; i < args.length; i += 2) {
        if (i + 1 >= args.length) throw TrellisError.valueError("Missing criterion in SUMIFS");
        const cRange = toMatrix(args[i]!).flatten();
        criteriaPairs.push({ items: cRange, crit: args[i + 1]! });
      }

      let total = 0;
      for (let idx = 0; idx < flatSum.length; idx++) {
        let allMatch = true;
        for (const pair of criteriaPairs) {
          if (!matchesCriterion(pair.items[idx]!, pair.crit)) {
            allMatch = false;
            break;
          }
        }
        if (allMatch) {
          const v = flatSum[idx];
          if (typeof v === "number") total += v;
        }
      }
      return total;
    }
  });

  // SUMPRODUCT
  reg.register({
    name: "SUMPRODUCT",
    category: "math",
    minArgs: 1,
    maxArgs: -1,
    description: "Sums the products of corresponding array components",
    fn: (args) => {
      const matrices = args.map((a) => toMatrix(a).flatten());
      if (matrices.length === 0) return 0;
      const count = matrices[0]!.length;

      for (let m = 1; m < matrices.length; m++) {
        if (matrices[m]!.length !== count) {
          throw TrellisError.valueError("SUMPRODUCT array dimensions must match exactly");
        }
      }

      let total = 0;
      for (let i = 0; i < count; i++) {
        let prod = 1;
        for (let m = 0; m < matrices.length; m++) {
          const val = matrices[m]![i];
          prod *= typeof val === "number" ? val : 0;
        }
        total += prod;
      }
      return total;
    }
  });

  // MMULT
  reg.register({
    name: "MMULT",
    category: "math",
    minArgs: 2,
    maxArgs: 2,
    description: "Matrix multiplication of two arrays",
    fn: (args) => {
      const a = toMatrix(args[0]!);
      const b = toMatrix(args[1]!);
      if (a.colCount !== b.rowCount) {
        throw TrellisError.valueError("MMULT matrix dimensions incompatible: columns of A must equal rows of B");
      }

      const rowsA = a.rowCount;
      const colsA = a.colCount;
      const colsB = b.colCount;
      const res: PrimitiveValue[][] = [];

      for (let r = 0; r < rowsA; r++) {
        const rowArr: PrimitiveValue[] = [];
        for (let c = 0; c < colsB; c++) {
          let dot = 0;
          for (let k = 0; k < colsA; k++) {
            dot += coerceToNumber(a.get(r, k)) * coerceToNumber(b.get(k, c));
          }
          rowArr.push(dot);
        }
        res.push(rowArr);
      }
      return new TMatrix(res);
    }
  });

  // TRANSPOSE
  reg.register({
    name: "TRANSPOSE",
    category: "math",
    minArgs: 1,
    maxArgs: 1,
    description: "Transposes the rows and columns of an array",
    fn: (args) => toMatrix(args[0]!).transpose()
  });
}

function toMatrix(val: CellValue): TMatrix {
  if (val instanceof TMatrix) return val;
  return TMatrix.scalar(val as PrimitiveValue);
}

export function matchesCriterion(val: PrimitiveValue, criterion: CellValue): boolean {
  if (criterion === null || criterion === undefined) {
    return val === null || val === undefined;
  }

  const critStr = String(criterion).trim();

  // Comparison prefix: >=, <=, <>, >, <, =
  if (critStr.startsWith(">=")) {
    const target = coerceToNumber(critStr.slice(2).trim());
    return coerceToNumber(val) >= target;
  }
  if (critStr.startsWith("<=")) {
    const target = coerceToNumber(critStr.slice(2).trim());
    return coerceToNumber(val) <= target;
  }
  if (critStr.startsWith("<>")) {
    const target = critStr.slice(2).trim();
    return String(val) !== target;
  }
  if (critStr.startsWith(">")) {
    const target = coerceToNumber(critStr.slice(1).trim());
    return coerceToNumber(val) > target;
  }
  if (critStr.startsWith("<")) {
    const target = coerceToNumber(critStr.slice(1).trim());
    return coerceToNumber(val) < target;
  }
  if (critStr.startsWith("=")) {
    const target = critStr.slice(1).trim();
    return compareValues(val, target) === 0;
  }

  // Exact comparison
  return compareValues(val, criterion) === 0;
}
