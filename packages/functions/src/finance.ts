/**
 * Quantitative financial mathematics, discounted cash flows, and numerical root solvers.
 */

import { FunctionRegistry, flattenNumericArgs } from "./registry.js";
import { CellValue, PrimitiveValue, TMatrix, TrellisError, coerceToNumber } from "@trellis/core";

export function registerFinanceFunctions(reg: FunctionRegistry): void {
  // NPV: Net Present Value
  reg.register({
    name: "NPV",
    category: "finance",
    minArgs: 2,
    maxArgs: -1,
    description: "Calculates Net Present Value of an investment based on discount rate and cash flows",
    fn: (args) => {
      const rate = coerceToNumber(args[0]!);
      const cashFlows = flattenNumericArgs(args.slice(1));
      let npv = 0;
      for (let t = 0; t < cashFlows.length; t++) {
        npv += cashFlows[t]! / Math.pow(1 + rate, t + 1);
      }
      return npv;
    }
  });

  // XNPV: Net Present Value for irregular dates
  reg.register({
    name: "XNPV",
    category: "finance",
    minArgs: 3,
    maxArgs: 3,
    description: "Calculates Net Present Value for an irregular schedule of cash flows and dates",
    fn: (args) => {
      const rate = coerceToNumber(args[0]!);
      const values = toMatrix(args[1]!).flatten().map(coerceToNumber);
      const dates = toMatrix(args[2]!).flatten().map(coerceToNumber);
      if (values.length !== dates.length || values.length === 0) throw TrellisError.numError();

      const d0 = dates[0]!;
      let xnpv = 0;
      for (let i = 0; i < values.length; i++) {
        const diffYears = (dates[i]! - d0) / 365;
        xnpv += values[i]! / Math.pow(1 + rate, diffYears);
      }
      return xnpv;
    }
  });

  // IRR: Internal Rate of Return
  reg.register({
    name: "IRR",
    category: "finance",
    minArgs: 1,
    maxArgs: 2,
    description: "Calculates the Internal Rate of Return for a series of periodic cash flows",
    fn: (args) => {
      const cashFlows = toMatrix(args[0]!).flatten().map(coerceToNumber);
      let guess = args.length > 1 ? coerceToNumber(args[1]!) : 0.1;
      if (cashFlows.length < 2) throw TrellisError.numError();

      // Newton-Raphson iterative root finding
      const maxIterations = 100;
      const tolerance = 1e-7;

      for (let iter = 0; iter < maxIterations; iter++) {
        let npv = 0;
        let dNpv = 0;

        for (let t = 0; t < cashFlows.length; t++) {
          const cf = cashFlows[t]!;
          const denom = Math.pow(1 + guess, t);
          npv += cf / denom;
          if (t > 0) {
            dNpv -= (t * cf) / Math.pow(1 + guess, t + 1);
          }
        }

        if (Math.abs(npv) < tolerance) {
          return guess;
        }

        if (Math.abs(dNpv) < 1e-12) {
          // Secant fallback adjustment
          guess += 0.01;
          continue;
        }

        const nextGuess = guess - npv / dNpv;
        if (Math.abs(nextGuess - guess) < tolerance) {
          return nextGuess;
        }
        guess = nextGuess;
      }

      throw TrellisError.numError("IRR failed to converge within maximum iterations");
    }
  });

  // XIRR: Internal Rate of Return for irregular cash flows
  reg.register({
    name: "XIRR",
    category: "finance",
    minArgs: 2,
    maxArgs: 3,
    description: "Calculates the Internal Rate of Return for cash flows that occur at irregular intervals",
    fn: (args) => {
      const values = toMatrix(args[0]!).flatten().map(coerceToNumber);
      const dates = toMatrix(args[1]!).flatten().map(coerceToNumber);
      let guess = args.length > 2 ? coerceToNumber(args[2]!) : 0.1;
      if (values.length !== dates.length || values.length < 2) throw TrellisError.numError();

      const d0 = dates[0]!;
      const maxIterations = 100;
      const tolerance = 1e-7;

      for (let iter = 0; iter < maxIterations; iter++) {
        let xnpv = 0;
        let dXnpv = 0;

        for (let i = 0; i < values.length; i++) {
          const cf = values[i]!;
          const dt = (dates[i]! - d0) / 365;
          const factor = Math.pow(1 + guess, dt);
          xnpv += cf / factor;
          if (dt !== 0) {
            dXnpv -= (dt * cf) / Math.pow(1 + guess, dt + 1);
          }
        }

        if (Math.abs(xnpv) < tolerance) {
          return guess;
        }

        if (Math.abs(dXnpv) < 1e-12) {
          guess += 0.01;
          continue;
        }

        const nextGuess = guess - xnpv / dXnpv;
        if (Math.abs(nextGuess - guess) < tolerance) {
          return nextGuess;
        }
        guess = nextGuess;
      }

      throw TrellisError.numError("XIRR failed to converge within maximum iterations");
    }
  });

  // PMT: Periodic Payment
  reg.register({
    name: "PMT",
    category: "finance",
    minArgs: 3,
    maxArgs: 5,
    description: "Calculates loan payment based on constant payments and interest rate",
    fn: (args) => {
      const rate = coerceToNumber(args[0]!);
      const nper = coerceToNumber(args[1]!);
      const pv = coerceToNumber(args[2]!);
      const fv = args.length > 3 ? coerceToNumber(args[3]!) : 0;
      const type = args.length > 4 ? coerceToNumber(args[4]!) : 0;

      if (rate === 0) {
        return -(pv + fv) / nper;
      }

      const pvif = Math.pow(1 + rate, nper);
      let pmt = (rate / (pvif - 1)) * -(pv * pvif + fv);
      if (type === 1) {
        pmt /= 1 + rate;
      }
      return pmt;
    }
  });

  // PV: Present Value
  reg.register({
    name: "PV",
    category: "finance",
    minArgs: 3,
    maxArgs: 5,
    description: "Calculates present value of an investment",
    fn: (args) => {
      const rate = coerceToNumber(args[0]!);
      const nper = coerceToNumber(args[1]!);
      const pmt = coerceToNumber(args[2]!);
      const fv = args.length > 3 ? coerceToNumber(args[3]!) : 0;
      const type = args.length > 4 ? coerceToNumber(args[4]!) : 0;

      if (rate === 0) {
        return -pmt * nper - fv;
      }

      const pvif = Math.pow(1 + rate, nper);
      return -(((1 / pvif) * (fv * rate - (pmt * (1 + rate * type) * (1 - pvif)))) / rate);
    }
  });

  // FV: Future Value
  reg.register({
    name: "FV",
    category: "finance",
    minArgs: 3,
    maxArgs: 5,
    description: "Calculates future value of an investment",
    fn: (args) => {
      const rate = coerceToNumber(args[0]!);
      const nper = coerceToNumber(args[1]!);
      const pmt = coerceToNumber(args[2]!);
      const pv = args.length > 3 ? coerceToNumber(args[3]!) : 0;
      const type = args.length > 4 ? coerceToNumber(args[4]!) : 0;

      if (rate === 0) {
        return -pv - pmt * nper;
      }

      const pvif = Math.pow(1 + rate, nper);
      return -(pv * pvif + (pmt * (1 + rate * type) * (pvif - 1)) / rate);
    }
  });

  // NPER: Number of Periods
  reg.register({
    name: "NPER",
    category: "finance",
    minArgs: 3,
    maxArgs: 5,
    description: "Calculates the number of periods for an investment",
    fn: (args) => {
      const rate = coerceToNumber(args[0]!);
      const pmt = coerceToNumber(args[1]!);
      const pv = coerceToNumber(args[2]!);
      const fv = args.length > 3 ? coerceToNumber(args[3]!) : 0;
      const type = args.length > 4 ? coerceToNumber(args[4]!) : 0;

      if (rate === 0) {
        return -(pv + fv) / pmt;
      }

      const num = pmt * (1 + rate * type) - fv * rate;
      const den = pv * rate + pmt * (1 + rate * type);
      return Math.log(num / den) / Math.log(1 + rate);
    }
  });

  // EFFECT, NOMINAL
  reg.register({
    name: "EFFECT",
    category: "finance",
    minArgs: 2,
    maxArgs: 2,
    description: "Calculates effective annual interest rate",
    fn: (args) => {
      const nominalRate = coerceToNumber(args[0]!);
      const npery = Math.trunc(coerceToNumber(args[1]!));
      if (nominalRate <= 0 || npery < 1) throw TrellisError.numError();
      return Math.pow(1 + nominalRate / npery, npery) - 1;
    }
  });

  reg.register({
    name: "NOMINAL",
    category: "finance",
    minArgs: 2,
    maxArgs: 2,
    description: "Calculates nominal annual interest rate",
    fn: (args) => {
      const effectRate = coerceToNumber(args[0]!);
      const npery = Math.trunc(coerceToNumber(args[1]!));
      if (effectRate <= 0 || npery < 1) throw TrellisError.numError();
      return npery * (Math.pow(effectRate + 1, 1 / npery) - 1);
    }
  });

  // SLN: Straight-Line Depreciation
  reg.register({
    name: "SLN",
    category: "finance",
    minArgs: 3,
    maxArgs: 3,
    description: "Calculates straight-line depreciation of an asset",
    fn: (args) => {
      const cost = coerceToNumber(args[0]!);
      const salvage = coerceToNumber(args[1]!);
      const life = coerceToNumber(args[2]!);
      if (life <= 0) throw TrellisError.numError();
      return (cost - salvage) / life;
    }
  });

  // SYD: Sum-of-Years' Digits Depreciation
  reg.register({
    name: "SYD",
    category: "finance",
    minArgs: 4,
    maxArgs: 4,
    description: "Calculates sum-of-years digits depreciation of an asset",
    fn: (args) => {
      const cost = coerceToNumber(args[0]!);
      const salvage = coerceToNumber(args[1]!);
      const life = coerceToNumber(args[2]!);
      const per = coerceToNumber(args[3]!);
      if (cost < 0 || salvage < 0 || life <= 0 || per < 1 || per > life) {
        throw TrellisError.numError();
      }
      return ((cost - salvage) * (life - per + 1) * 2) / (life * (life + 1));
    }
  });

  // DB: Fixed-Declining Balance Depreciation
  reg.register({
    name: "DB",
    category: "finance",
    minArgs: 4,
    maxArgs: 5,
    description: "Calculates fixed-declining balance depreciation of an asset",
    fn: (args) => {
      const cost = coerceToNumber(args[0]!);
      const salvage = coerceToNumber(args[1]!);
      const life = Math.trunc(coerceToNumber(args[2]!));
      const period = Math.trunc(coerceToNumber(args[3]!));
      const month = args.length > 4 ? Math.trunc(coerceToNumber(args[4]!)) : 12;

      if (cost <= 0 || salvage < 0 || life <= 0 || period < 1 || month < 1 || month > 12) {
        throw TrellisError.numError();
      }
      if (period > life + (month === 12 ? 0 : 1)) {
        throw TrellisError.numError();
      }

      // Fixed rate rounded to 3 decimal places
      const rate = Math.round((1 - Math.pow(salvage / cost, 1 / life)) * 1000) / 1000;

      let bookValue = cost;
      let dep = 0;

      // Period 1
      const initialDep = cost * rate * (month / 12);
      if (period === 1) return initialDep;

      bookValue -= initialDep;

      // Subsequent periods
      for (let p = 2; p <= period; p++) {
        if (p === life + 1) {
          dep = (bookValue * rate * (12 - month)) / 12;
        } else {
          dep = bookValue * rate;
        }
        bookValue -= dep;
      }

      return dep;
    }
  });

  // DDB: Double-Declining Balance Depreciation
  reg.register({
    name: "DDB",
    category: "finance",
    minArgs: 4,
    maxArgs: 5,
    description: "Calculates depreciation using double-declining balance or custom factor",
    fn: (args) => {
      const cost = coerceToNumber(args[0]!);
      const salvage = coerceToNumber(args[1]!);
      const life = coerceToNumber(args[2]!);
      const period = coerceToNumber(args[3]!);
      const factor = args.length > 4 ? coerceToNumber(args[4]!) : 2;

      if (cost < 0 || salvage < 0 || life <= 0 || period < 1 || period > life || factor <= 0) {
        throw TrellisError.numError();
      }

      let bookValue = cost;
      let dep = 0;

      for (let p = 1; p <= period; p++) {
        const potentialDep = (bookValue * factor) / life;
        dep = Math.min(potentialDep, Math.max(0, bookValue - salvage));
        bookValue -= dep;
      }

      return dep;
    }
  });

  // MIRR: Modified Internal Rate of Return
  reg.register({
    name: "MIRR",
    category: "finance",
    minArgs: 3,
    maxArgs: 3,
    description: "Calculates Modified Internal Rate of Return for periodic cash flows",
    fn: (args) => {
      const flows = toMatrix(args[0]!).flatten().map(coerceToNumber);
      const financeRate = coerceToNumber(args[1]!);
      const reinvestRate = coerceToNumber(args[2]!);

      const n = flows.length;
      if (n < 2) throw TrellisError.numError();

      let npvPos = 0;
      let npvNeg = 0;
      let hasPos = false;
      let hasNeg = false;

      for (let t = 0; t < n; t++) {
        const cf = flows[t]!;
        if (cf > 0) {
          npvPos += cf * Math.pow(1 + reinvestRate, n - 1 - t);
          hasPos = true;
        } else if (cf < 0) {
          npvNeg += cf / Math.pow(1 + financeRate, t);
          hasNeg = true;
        }
      }

      if (!hasPos || !hasNeg || npvNeg === 0) throw TrellisError.numError();

      return Math.pow(-npvPos / npvNeg, 1 / (n - 1)) - 1;
    }
  });
}

function toMatrix(val: CellValue): TMatrix {
  if (val instanceof TMatrix) return val;
  return TMatrix.scalar(val as PrimitiveValue);
}
