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

  // NORM.INV: Inverse of the normal cumulative distribution
  reg.register({
    name: "NORM.INV",
    category: "stats",
    minArgs: 3,
    maxArgs: 3,
    description: "Calculates inverse of the normal cumulative distribution",
    fn: (args) => {
      const prob = coerceToNumber(args[0]!);
      const mean = coerceToNumber(args[1]!);
      const stdev = coerceToNumber(args[2]!);
      if (prob <= 0 || prob >= 1 || stdev <= 0) throw TrellisError.numError();
      return mean + normInvStandard(prob) * stdev;
    }
  });

  // COVARIANCE.S: Sample Covariance
  reg.register({
    name: "COVARIANCE.S",
    category: "stats",
    minArgs: 2,
    maxArgs: 2,
    description: "Calculates sample covariance of two data series",
    fn: (args) => {
      const arr1 = toMatrix(args[0]!).flatten().map(coerceToNumber);
      const arr2 = toMatrix(args[1]!).flatten().map(coerceToNumber);
      if (arr1.length !== arr2.length || arr1.length < 2) throw TrellisError.numError();
      const n = arr1.length;
      let sum1 = 0;
      let sum2 = 0;
      for (let i = 0; i < n; i++) {
        sum1 += arr1[i]!;
        sum2 += arr2[i]!;
      }
      const mean1 = sum1 / n;
      const mean2 = sum2 / n;
      let cov = 0;
      for (let i = 0; i < n; i++) {
        cov += (arr1[i]! - mean1) * (arr2[i]! - mean2);
      }
      return cov / (n - 1);
    }
  });

  // COVARIANCE.P: Population Covariance
  reg.register({
    name: "COVARIANCE.P",
    category: "stats",
    minArgs: 2,
    maxArgs: 2,
    description: "Calculates population covariance of two data series",
    fn: (args) => {
      const arr1 = toMatrix(args[0]!).flatten().map(coerceToNumber);
      const arr2 = toMatrix(args[1]!).flatten().map(coerceToNumber);
      if (arr1.length !== arr2.length || arr1.length === 0) throw TrellisError.numError();
      const n = arr1.length;
      let sum1 = 0;
      let sum2 = 0;
      for (let i = 0; i < n; i++) {
        sum1 += arr1[i]!;
        sum2 += arr2[i]!;
      }
      const mean1 = sum1 / n;
      const mean2 = sum2 / n;
      let cov = 0;
      for (let i = 0; i < n; i++) {
        cov += (arr1[i]! - mean1) * (arr2[i]! - mean2);
      }
      return cov / n;
    }
  });

  // PERCENTILE.INC
  reg.register({
    name: "PERCENTILE.INC",
    category: "stats",
    minArgs: 2,
    maxArgs: 2,
    description: "Calculates the k-th percentile of values in a range",
    fn: (args) => reg.call("PERCENTILE", args, null as any)
  });

  // QUARTILE.INC
  reg.register({
    name: "QUARTILE.INC",
    category: "stats",
    minArgs: 2,
    maxArgs: 2,
    description: "Calculates the quartile of a data set based on percentile values",
    fn: (args) => {
      const quart = Math.trunc(coerceToNumber(args[1]!));
      if (quart < 0 || quart > 4) throw TrellisError.numError();
      return reg.call("PERCENTILE", [args[0]!, quart * 0.25], null as any);
    }
  });

  // MODE.SNGL: Most frequent value
  reg.register({
    name: "MODE.SNGL",
    category: "stats",
    minArgs: 1,
    maxArgs: -1,
    description: "Calculates the most frequently occurring value in a dataset",
    fn: (args) => {
      const nums = flattenNumericArgs(args);
      if (nums.length === 0) throw TrellisError.naError();

      const counts = new Map<number, number>();
      let maxCount = 0;
      for (const n of nums) {
        const c = (counts.get(n) || 0) + 1;
        counts.set(n, c);
        if (c > maxCount) maxCount = c;
      }

      if (maxCount <= 1) throw TrellisError.naError();

      for (const n of nums) {
        if (counts.get(n) === maxCount) {
          return n;
        }
      }
      throw TrellisError.naError();
    }
  });
}

function toMatrix(val: CellValue): TMatrix {
  if (val instanceof TMatrix) return val;
  return TMatrix.scalar(val as PrimitiveValue);
}

/**
 * Rational approximation of standard normal quantile function (Acklam's algorithm).
 */
function normInvStandard(p: number): number {
  const a = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.38357751867269e2,
    -3.066479806614716e1,
    2.506628277459239
  ];
  const b = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1
  ];
  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783
  ];
  const d = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996,
    3.754408661907416
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
    ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  );
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
