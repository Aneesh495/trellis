/**
 * Date arithmetic, calendar day counting, business day calculators, and time components.
 */

import { FunctionRegistry } from "./registry.js";
import { CellValue, PrimitiveValue, TMatrix, coerceToNumber, dateToSerial, serialToDate } from "@trellis/core";

export function registerDateTimeFunctions(reg: FunctionRegistry): void {
  // DATE
  reg.register({
    name: "DATE",
    category: "datetime",
    minArgs: 3,
    maxArgs: 3,
    description: "Returns the serial number of a particular date",
    fn: (args) => {
      const year = Math.trunc(coerceToNumber(args[0]!));
      const month = Math.trunc(coerceToNumber(args[1]!));
      const day = Math.trunc(coerceToNumber(args[2]!));
      const d = new Date(Date.UTC(year, month - 1, day));
      return dateToSerial(d);
    }
  });

  // TIME
  reg.register({
    name: "TIME",
    category: "datetime",
    minArgs: 3,
    maxArgs: 3,
    description: "Returns decimal fraction of a 24-hour day",
    fn: (args) => {
      const hour = coerceToNumber(args[0]!);
      const minute = coerceToNumber(args[1]!);
      const second = coerceToNumber(args[2]!);
      const totalSeconds = (hour * 3600 + minute * 60 + second) % 86400;
      return totalSeconds / 86400;
    }
  });

  // YEAR, MONTH, DAY
  reg.register({
    name: "YEAR",
    category: "datetime",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns the year of a date",
    fn: (args) => {
      const d = serialToDate(coerceToNumber(args[0]!));
      return d.getUTCFullYear();
    }
  });

  reg.register({
    name: "MONTH",
    category: "datetime",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns the month of a date (1 to 12)",
    fn: (args) => {
      const d = serialToDate(coerceToNumber(args[0]!));
      return d.getUTCMonth() + 1;
    }
  });

  reg.register({
    name: "DAY",
    category: "datetime",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns the day of the month (1 to 31)",
    fn: (args) => {
      const d = serialToDate(coerceToNumber(args[0]!));
      return d.getUTCDate();
    }
  });

  // HOUR, MINUTE, SECOND
  reg.register({
    name: "HOUR",
    category: "datetime",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns the hour of a time value (0 to 23)",
    fn: (args) => {
      const d = serialToDate(coerceToNumber(args[0]!));
      return d.getUTCHours();
    }
  });

  reg.register({
    name: "MINUTE",
    category: "datetime",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns the minute of a time value (0 to 59)",
    fn: (args) => {
      const d = serialToDate(coerceToNumber(args[0]!));
      return d.getUTCMinutes();
    }
  });

  reg.register({
    name: "SECOND",
    category: "datetime",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns the second of a time value (0 to 59)",
    fn: (args) => {
      const d = serialToDate(coerceToNumber(args[0]!));
      return d.getUTCSeconds();
    }
  });

  // NOW, TODAY (Volatile)
  reg.register({
    name: "NOW",
    category: "datetime",
    minArgs: 0,
    maxArgs: 0,
    isVolatile: true,
    description: "Returns current date and time serial number",
    fn: () => dateToSerial(new Date())
  });

  reg.register({
    name: "TODAY",
    category: "datetime",
    minArgs: 0,
    maxArgs: 0,
    isVolatile: true,
    description: "Returns current date serial number without time component",
    fn: () => {
      const now = new Date();
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      return dateToSerial(d);
    }
  });

  // EDATE: Adds or subtracts months
  reg.register({
    name: "EDATE",
    category: "datetime",
    minArgs: 2,
    maxArgs: 2,
    description: "Returns date serial number indicated number of months before or after start date",
    fn: (args) => {
      const startSerial = coerceToNumber(args[0]!);
      const months = Math.trunc(coerceToNumber(args[1]!));
      const d = serialToDate(startSerial);
      const targetMonth = d.getUTCMonth() + months;
      const originalDay = d.getUTCDate();

      d.setUTCMonth(targetMonth, 1);
      const maxDaysInTarget = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(originalDay, maxDaysInTarget));

      return dateToSerial(d);
    }
  });

  // EOMONTH: End of month
  reg.register({
    name: "EOMONTH",
    category: "datetime",
    minArgs: 2,
    maxArgs: 2,
    description: "Returns date serial number for last day of month indicated months away",
    fn: (args) => {
      const startSerial = coerceToNumber(args[0]!);
      const months = Math.trunc(coerceToNumber(args[1]!));
      const d = serialToDate(startSerial);
      const targetMonth = d.getUTCMonth() + months;
      const endOfMonth = new Date(Date.UTC(d.getUTCFullYear(), targetMonth + 1, 0));
      return dateToSerial(endOfMonth);
    }
  });

  // NETWORKDAYS: Working days excluding weekends and holidays
  reg.register({
    name: "NETWORKDAYS",
    category: "datetime",
    minArgs: 2,
    maxArgs: 3,
    description: "Calculates the number of whole working days between two dates",
    fn: (args) => {
      let startSerial = Math.trunc(coerceToNumber(args[0]!));
      let endSerial = Math.trunc(coerceToNumber(args[1]!));
      const holidays = new Set<number>();

      if (args.length > 2 && args[2]) {
        for (const h of toMatrix(args[2]).flatten()) {
          if (typeof h === "number" || h instanceof Date) {
            holidays.add(Math.trunc(coerceToNumber(h)));
          }
        }
      }

      const sign = endSerial >= startSerial ? 1 : -1;
      const minS = Math.min(startSerial, endSerial);
      const maxS = Math.max(startSerial, endSerial);

      let workdays = 0;
      for (let s = minS; s <= maxS; s++) {
        const d = serialToDate(s);
        const dayOfWeek = d.getUTCDay(); // 0 is Sunday, 6 is Saturday
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(s)) {
          workdays++;
        }
      }
      return sign * workdays;
    }
  });

  // WORKDAY: Adds working days excluding weekends and holidays
  reg.register({
    name: "WORKDAY",
    category: "datetime",
    minArgs: 2,
    maxArgs: 3,
    description: "Calculates the date serial after a specified number of working days",
    fn: (args) => {
      let currentSerial = Math.trunc(coerceToNumber(args[0]!));
      let daysRemaining = Math.trunc(coerceToNumber(args[1]!));
      const holidays = new Set<number>();

      if (args.length > 2 && args[2]) {
        for (const h of toMatrix(args[2]).flatten()) {
          if (typeof h === "number" || h instanceof Date) {
            holidays.add(Math.trunc(coerceToNumber(h)));
          }
        }
      }

      const step = daysRemaining >= 0 ? 1 : -1;
      let count = Math.abs(daysRemaining);

      while (count > 0) {
        currentSerial += step;
        const d = serialToDate(currentSerial);
        const dayOfWeek = d.getUTCDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(currentSerial)) {
          count--;
        }
      }

      return currentSerial;
    }
  });

  // DAYS360: Computes days between two dates based on a 360-day year
  reg.register({
    name: "DAYS360",
    category: "datetime",
    minArgs: 2,
    maxArgs: 3,
    description: "Calculates the number of days between two dates based on a 360-day year",
    fn: (args) => {
      const startSerial = Math.trunc(coerceToNumber(args[0]!));
      const endSerial = Math.trunc(coerceToNumber(args[1]!));
      const european = args.length > 2 ? Boolean(args[2]) : false;

      const d1 = serialToDate(startSerial);
      const d2 = serialToDate(endSerial);

      let y1 = d1.getUTCFullYear();
      let m1 = d1.getUTCMonth() + 1;
      let day1 = d1.getUTCDate();

      let y2 = d2.getUTCFullYear();
      let m2 = d2.getUTCMonth() + 1;
      let day2 = d2.getUTCDate();

      if (european) {
        if (day1 === 31) day1 = 30;
        if (day2 === 31) day2 = 30;
      } else {
        if (day1 === 31) day1 = 30;
        if (day2 === 31 && day1 >= 30) day2 = 30;
      }

      return (y2 - y1) * 360 + (m2 - m1) * 30 + (day2 - day1);
    }
  });

  // ISOWEEKNUM: Returns the ISO 8601 week number of the year
  reg.register({
    name: "ISOWEEKNUM",
    category: "datetime",
    minArgs: 1,
    maxArgs: 1,
    description: "Returns the ISO 8601 week number of the year for a given date",
    fn: (args) => {
      const serial = Math.trunc(coerceToNumber(args[0]!));
      const date = serialToDate(serial);
      const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      const dayNum = (target.getUTCDay() + 6) % 7;
      target.setUTCDate(target.getUTCDate() - dayNum + 3);
      const firstThursday = target.valueOf();
      target.setUTCMonth(0, 1);
      if (target.getUTCDay() !== 4) {
        target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
      }
      return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    }
  });

  // YEARFRAC: Financial day count fraction between two dates
  reg.register({
    name: "YEARFRAC",
    category: "datetime",
    minArgs: 2,
    maxArgs: 3,
    description: "Calculates fraction of year represented by number of days between two dates",
    fn: (args) => {
      const startSerial = coerceToNumber(args[0]!);
      const endSerial = coerceToNumber(args[1]!);
      const basis = args.length > 2 ? Math.trunc(coerceToNumber(args[2]!)) : 0;

      const minS = Math.min(startSerial, endSerial);
      const maxS = Math.max(startSerial, endSerial);
      const diffDays = maxS - minS;

      switch (basis) {
        case 1: {
          // Actual/actual
          const d1 = serialToDate(minS);
          const d2 = serialToDate(maxS);
          const y1 = d1.getUTCFullYear();
          const y2 = d2.getUTCFullYear();
          const avgDays = (y1 === y2) ? (isLeapYear(y1) ? 366 : 365) : 365.2425;
          return diffDays / avgDays;
        }
        case 2:
          // Actual/360
          return diffDays / 360;
        case 3:
          // Actual/365
          return diffDays / 365;
        case 4: {
          // European 30/360
          const d1 = serialToDate(minS);
          const d2 = serialToDate(maxS);
          let day1 = d1.getUTCDate();
          let day2 = d2.getUTCDate();
          if (day1 === 31) day1 = 30;
          if (day2 === 31) day2 = 30;
          const days360 = (d2.getUTCFullYear() - d1.getUTCFullYear()) * 360 +
            (d2.getUTCMonth() - d1.getUTCMonth()) * 30 +
            (day2 - day1);
          return days360 / 360;
        }
        case 0:
        default: {
          // US (NASD) 30/360
          const d1 = serialToDate(minS);
          const d2 = serialToDate(maxS);
          let day1 = d1.getUTCDate();
          let day2 = d2.getUTCDate();
          if (day1 === 31) day1 = 30;
          if (day2 === 31 && day1 >= 30) day2 = 30;
          const days360 = (d2.getUTCFullYear() - d1.getUTCFullYear()) * 360 +
            (d2.getUTCMonth() - d1.getUTCMonth()) * 30 +
            (day2 - day1);
          return days360 / 360;
        }
      }
    }
  });
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function toMatrix(val: CellValue): TMatrix {
  if (val instanceof TMatrix) return val;
  return TMatrix.scalar(val as PrimitiveValue);
}
