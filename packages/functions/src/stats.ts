/**
 * Statistical distributions, regressions, rankings, and variance aggregations.
 */

import { FunctionRegistry, flattenNumericArgs, flattenAllArgs } from "./registry.js";
import { CellValue, PrimitiveValue, TMatrix, TrellisError, coerceToNumber } from "@trellis/core";
import { matchesCriterion } from "./math.js";

export function registerStatsFunctions(reg: FunctionRegistry): void {
  // AVERAGE
  reg.register({
    name: "AVERAGE",
    category: "stats",
    minArgs: 1,
    maxArgs: -1,
    description: "Calculates the arithmetic mean of numeric arguments",
    fn: (args) => {
      const nums = flattenNumericArgs(args);
      if (nums.length === 0) throw TrellisError.divZero();
      let sum = 0;
      for (let i = 0; i < nums.length; i++) sum += nums[i]!;
      return sum / nums.length;
    }
  });

  // AVERAGEIF
  reg.register({
    name: "AVERAGEIF",
    category: "stats",
    minArgs: 2,
    maxArgs: 3,
    description: "Calculates average of cells matching criterion",
    fn: (args) => {
      const rangeMat = toMatrix(args[0]!).flatten();
      const criterion = args[1]!;
      const avgMat = args.length > 2 ? toMatrix(args[2]!).flatten() : rangeMat;

      let sum = 0;
      let count = 0;
      for (let i = 0; i < rangeMat.length; i++) {
        if (matchesCriterion(rangeMat[i]!, criterion)) {
          const val = avgMat[i];
          if (typeof val === "number") {
            sum += val;
            count++;
          }
        }
      }
      if (count === 0) throw TrellisError.divZero();
      return sum / count;
    }
  });

  // COUNT
  reg.register({
    name: "COUNT",
    category: "stats",
    minArgs: 1,
    maxArgs: -1,
    description: "Counts the number of cells that contain numbers",
    fn: (args) => {
      let count = 0;
      for (const arg of args) {
        if (arg instanceof TMatrix) {
          for (const v of arg.flatten()) {
            if (typeof v === "number" || v instanceof Date) count++;
          }
        } else if (typeof arg === "number" || arg instanceof Date) {
          count++;
        }
      }
      return count;
    }
  });

  // COUNTA
  reg.register({
    name: "COUNTA",
    category: "stats",
    minArgs: 1,
    maxArgs: -1,
    description: "Counts non-empty cells across arguments",
    fn: (args) => {
      let count = 0;
      for (const v of flattenAllArgs(args)) {
        if (v !== null && v !== undefined && v !== "") {
          count++;
        }
      }
      return count;
    }
  });

  // COUNTBLANK
  reg.register({
    name: "COUNTBLANK",
    category: "stats",
    minArgs: 1,
    maxArgs: 1,
    description: "Counts empty cells in a range",
    fn: (args) => {
      let count = 0;
      for (const v of flattenAllArgs(args)) {
        if (v === null || v === undefined || v === "") {
          count++;
        }
      }
      return count;
    }
  });

  // COUNTIF
  reg.register({
    name: "COUNTIF",
    category: "stats",
    minArgs: 2,
    maxArgs: 2,
    description: "Counts cells that meet a given criterion",
    fn: (args) => {
      const items = toMatrix(args[0]!).flatten();
      const crit = args[1]!;
      let count = 0;
      for (const item of items) {
        if (matchesCriterion(item, crit)) count++;
      }
      return count;
    }
  });

  // MIN, MAX
  reg.register({
    name: "MIN",
    category: "stats",
    minArgs: 1,
    maxArgs: -1,
    description: "Returns smallest number among arguments",
    fn: (args) => {
      const nums = flattenNumericArgs(args);
      if (nums.length === 0) return 0;
      let min = nums[0]!;
      for (let i = 1; i < nums.length; i++) {
        if (nums[i]! < min) min = nums[i]!;
      }
      return min;
    }
  });

  reg.register({
    name: "MAX",
    category: "stats",
    minArgs: 1,
    maxArgs: -1,
    description: "Returns largest number among arguments",
    fn: (args) => {
      const nums = flattenNumericArgs(args);
      if (nums.length === 0) return 0;
      let max = nums[0]!;
      for (let i = 1; i < nums.length; i++) {
        if (nums[i]! > max) max = nums[i]!;
      }
      return max;
    }
  });

  // MEDIAN
  reg.register({
    name: "MEDIAN",
    category: "stats",
    minArgs: 1,
    maxArgs: -1,
    description: "Calculates the median of numbers",
    fn: (args) => {
      const nums = flattenNumericArgs(args).sort((a, b) => a - b);
      if (nums.length === 0) throw TrellisError.numError();
      const mid = Math.floor(nums.length / 2);
      if (nums.length % 2 === 1) {
        return nums[mid]!;
      }
      return (nums[mid - 1]! + nums[mid]!) / 2;
    }
  });

  // STDEV.S, STDEV.P
  reg.register({
    name: "STDEV.S",
    category: "stats",
    minArgs: 1,
    maxArgs: -1,
    description: "Calculates sample standard deviation",
    fn: (args) => {
      const nums = flattenNumericArgs(args);
      if (nums.length < 2) throw TrellisError.divZero();
      let sum = 0;
      for (const n of nums) sum += n;
      const mean = sum / nums.length;

      let varianceSum = 0;
      for (const n of nums) {
        const diff = n - mean;
        varianceSum += diff * diff;
      }
      return Math.sqrt(varianceSum / (nums.length - 1));
    }
  });

  reg.register({
    name: "STDEV.P",
    category: "stats",
    minArgs: 1,
    maxArgs: -1,
    description: "Calculates population standard deviation",
    fn: (args) => {
      const nums = flattenNumericArgs(args);
      if (nums.length === 0) throw TrellisError.divZero();
      let sum = 0;
      for (const n of nums) sum += n;
      const mean = sum / nums.length;

      let varianceSum = 0;
      for (const n of nums) {
        const diff = n - mean;
        varianceSum += diff * diff;
      }
      return Math.sqrt(varianceSum / nums.length);
    }
  });

  // VAR.S, VAR.P
  reg.register({
    name: "VAR.S",
    category: "stats",
    minArgs: 1,
    maxArgs: -1,
    description: "Calculates sample variance",
    fn: (args) => {
      const nums = flattenNumericArgs(args);
      if (nums.length < 2) throw TrellisError.divZero();
      let sum = 0;
      for (const n of nums) sum += n;
      const mean = sum / nums.length;

      let varianceSum = 0;
      for (const n of nums) {
        const diff = n - mean;
        varianceSum += diff * diff;
      }
      return varianceSum / (nums.length - 1);
    }
  });

  reg.register({
    name: "VAR.P",
    category: "stats",
    minArgs: 1,
    maxArgs: -1,
    description: "Calculates population variance",
    fn: (args) => {
      const nums = flattenNumericArgs(args);
      if (nums.length === 0) throw TrellisError.divZero();
      let sum = 0;
      for (const n of nums) sum += n;
      const mean = sum / nums.length;

      let varianceSum = 0;
      for (const n of nums) {
        const diff = n - mean;
        varianceSum += diff * diff;
      }
      return varianceSum / nums.length;
    }
  });

  // PERCENTILE
  reg.register({
    name: "PERCENTILE",
    category: "stats",
    minArgs: 2,
    maxArgs: 2,
    description: "Returns the k-th percentile of values in a range",
    fn: (args) => {
      const nums = flattenNumericArgs([args[0]!]).sort((a, b) => a - b);
      const k = coerceToNumber(args[1]!);
      if (nums.length === 0 || k < 0 || k > 1) throw TrellisError.numError();
      if (k === 0) return nums[0]!;
      if (k === 1) return nums[nums.length - 1]!;

      const rank = k * (nums.length - 1);
      const lower = Math.floor(rank);
      const upper = Math.ceil(rank);
      const weight = rank - lower;
      return nums[lower]! * (1 - weight) + nums[upper]! * weight;
    }
  });

  // CORREL, SLOPE, INTERCEPT, FORECAST
  reg.register({
    name: "CORREL",
    category: "stats",
    minArgs: 2,
    maxArgs: 2,
    description: "Pearson product moment correlation coefficient",
    fn: (args) => {
      const y = toMatrix(args[0]!).flatten().map(coerceToNumber);
      const x = toMatrix(args[1]!).flatten().map(coerceToNumber);
      if (y.length !== x.length || y.length === 0) throw TrellisError.numError();

      const n = y.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
      for (let i = 0; i < n; i++) {
        sumX += x[i]!;
        sumY += y[i]!;
        sumXY += x[i]! * y[i]!;
        sumX2 += x[i]! * x[i]!;
        sumY2 += y[i]! * y[i]!;
      }

      const num = n * sumXY - sumX * sumY;
      const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
      if (den === 0) throw TrellisError.divZero();
      return num / den;
    }
  });

  reg.register({
    name: "SLOPE",
    category: "stats",
    minArgs: 2,
    maxArgs: 2,
    description: "Slope of the linear regression line",
    fn: (args) => {
      const y = toMatrix(args[0]!).flatten().map(coerceToNumber);
      const x = toMatrix(args[1]!).flatten().map(coerceToNumber);
      if (y.length !== x.length || y.length === 0) throw TrellisError.numError();

      const n = y.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let i = 0; i < n; i++) {
        sumX += x[i]!;
        sumY += y[i]!;
        sumXY += x[i]! * y[i]!;
        sumX2 += x[i]! * x[i]!;
      }

      const den = n * sumX2 - sumX * sumX;
      if (den === 0) throw TrellisError.divZero();
      return (n * sumXY - sumX * sumY) / den;
    }
  });

  reg.register({
    name: "INTERCEPT",
    category: "stats",
    minArgs: 2,
    maxArgs: 2,
    description: "Intercept of the linear regression line",
    fn: (args) => {
      const y = toMatrix(args[0]!).flatten().map(coerceToNumber);
      const x = toMatrix(args[1]!).flatten().map(coerceToNumber);
      const slope = reg.call("SLOPE", args, {} as any) as number;
      let sumY = 0, sumX = 0;
      for (let i = 0; i < y.length; i++) {
        sumY += y[i]!;
        sumX += x[i]!;
      }
      return (sumY - slope * sumX) / y.length;
    }
  });

  reg.register({
    name: "FORECAST",
    category: "stats",
    minArgs: 3,
    maxArgs: 3,
    description: "Calculates future value along a linear trend",
    fn: (args) => {
      const targetX = coerceToNumber(args[0]!);
      const slope = reg.call("SLOPE", [args[1]!, args[2]!], {} as any) as number;
      const intercept = reg.call("INTERCEPT", [args[1]!, args[2]!], {} as any) as number;
      return intercept + slope * targetX;
    }
  });

  // NORM.DIST
  reg.register({
    name: "NORM.DIST",
    category: "stats",
    minArgs: 4,
    maxArgs: 4,
    description: "Normal distribution probability or density",
    fn: (args) => {
      const x = coerceToNumber(args[0]!);
      const mean = coerceToNumber(args[1]!);
      const stdev = coerceToNumber(args[2]!);
      const cumulative = Boolean(args[3]);
      if (stdev <= 0) throw TrellisError.numError();

      const z = (x - mean) / stdev;
      if (cumulative) {
        return 0.5 * (1 + errorFunction(z / Math.SQRT2));
      } else {
        return (1 / (stdev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
      }
    }
  });
}

function toMatrix(val: CellValue): TMatrix {
  if (val instanceof TMatrix) return val;
  return TMatrix.scalar(val as PrimitiveValue);
}

/**
 * Abramowitz and Stegun numerical approximation for Gauss error function erf(x).
 */
function errorFunction(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}
