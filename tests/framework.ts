/**
 * Lightweight test framework for Trellis with zero external dependencies.
 * Provides describe/it blocks, rich assertion primitives, and test statistics.
 */

export interface TestResult {
  name: string;
  suite: string;
  passed: boolean;
  durationMs: number;
  error?: Error;
}

export interface SuiteStats {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestResult[];
}

type TestFn = () => void | Promise<void>;

interface TestCase {
  name: string;
  suite: string;
  fn: TestFn;
}

const registeredSuites: Map<string, TestCase[]> = new Map();
let currentSuite = "Default";

export function describe(name: string, fn: () => void): void {
  const previousSuite = currentSuite;
  currentSuite = previousSuite === "Default" ? name : `${previousSuite} > ${name}`;
  if (!registeredSuites.has(currentSuite)) {
    registeredSuites.set(currentSuite, []);
  }
  try {
    fn();
  } finally {
    currentSuite = previousSuite;
  }
}

export function it(name: string, fn: TestFn): void {
  const suiteCases = registeredSuites.get(currentSuite) || [];
  suiteCases.push({ name, suite: currentSuite, fn });
  registeredSuites.set(currentSuite, suiteCases);
}

export const test = it;

// Assertion utilities
export class AssertionError extends Error {
  constructor(message: string, public actual?: unknown, public expected?: unknown) {
    super(message);
    this.name = "AssertionError";
  }
}

export function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) {
    throw new AssertionError(message, condition, true);
  }
}

export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    const msg = message || `Expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`;
    throw new AssertionError(msg, actual, expected);
  }
}

export function assertNotEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual === expected) {
    const msg = message || `Expected value not to equal ${JSON.stringify(expected)}`;
    throw new AssertionError(msg, actual, expected);
  }
}

export function assertDeepEqual<T>(actual: T, expected: T, message?: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    const msg = message || `Deep equality mismatch:\nExpected: ${expectedStr}\nActual:   ${actualStr}`;
    throw new AssertionError(msg, actual, expected);
  }
}

export function assertCloseTo(actual: number, expected: number, epsilon = 1e-7, message?: string): void {
  const diff = Math.abs(actual - expected);
  if (diff > epsilon) {
    const msg = message || `Expected ${actual} to be close to ${expected} (delta: ${diff} > epsilon: ${epsilon})`;
    throw new AssertionError(msg, actual, expected);
  }
}

export function assertThrows(fn: () => unknown, expectedErrorSubstr?: string): void {
  let threw = false;
  let thrownError: unknown;
  try {
    fn();
  } catch (err) {
    threw = true;
    thrownError = err;
    if (expectedErrorSubstr && err instanceof Error) {
      if (!err.message.includes(expectedErrorSubstr)) {
        throw new AssertionError(
          `Expected error containing "${expectedErrorSubstr}", but caught: "${err.message}"`,
          err.message,
          expectedErrorSubstr
        );
      }
    }
  }
  if (!threw) {
    throw new AssertionError("Expected function to throw an error, but it returned normally");
  }
}

export async function assertRejects(fn: () => Promise<unknown>, expectedErrorSubstr?: string): Promise<void> {
  let threw = false;
  try {
    await fn();
  } catch (err) {
    threw = true;
    if (expectedErrorSubstr && err instanceof Error) {
      if (!err.message.includes(expectedErrorSubstr)) {
        throw new AssertionError(
          `Expected rejected error containing "${expectedErrorSubstr}", but caught: "${err.message}"`,
          err.message,
          expectedErrorSubstr
        );
      }
    }
  }
  if (!threw) {
    throw new AssertionError("Expected promise to reject, but it resolved normally");
  }
}

export async function runAllTests(filter?: string): Promise<SuiteStats> {
  const stats: SuiteStats = {
    total: 0,
    passed: 0,
    failed: 0,
    durationMs: 0,
    results: []
  };

  const startTime = Date.now();

  for (const [suiteName, tests] of registeredSuites.entries()) {
    const matchingTests = filter ? tests.filter((t) => (t.suite + " " + t.name).toLowerCase().includes(filter.toLowerCase())) : tests;
    if (matchingTests.length === 0) continue;

    console.log(`\n\x1b[1m\x1b[36m[SUITE]\x1b[0m ${suiteName}`);
    for (const testCase of matchingTests) {
      stats.total++;
      const tStart = performance.now();
      try {
        await testCase.fn();
        const duration = performance.now() - tStart;
        stats.passed++;
        stats.results.push({
          name: testCase.name,
          suite: testCase.suite,
          passed: true,
          durationMs: duration
        });
        console.log(`  \x1b[32m✓\x1b[0m ${testCase.name} \x1b[90m(${duration.toFixed(2)} ms)\x1b[0m`);
      } catch (err) {
        const duration = performance.now() - tStart;
        stats.failed++;
        const error = err instanceof Error ? err : new Error(String(err));
        stats.results.push({
          name: testCase.name,
          suite: testCase.suite,
          passed: false,
          durationMs: duration,
          error
        });
        console.log(`  \x1b[31m✗\x1b[0m ${testCase.name} \x1b[90m(${duration.toFixed(2)} ms)\x1b[0m`);
        console.error(`    \x1b[31m${error.message}\x1b[0m`);
        if (error.stack) {
          const formattedStack = error.stack
            .split("\n")
            .slice(1, 4)
            .map((line) => `      \x1b[90m${line.trim()}\x1b[0m`)
            .join("\n");
          console.error(formattedStack);
        }
      }
    }
  }

  stats.durationMs = Date.now() - startTime;
  return stats;
}

export function clearRegisteredSuites(): void {
  registeredSuites.clear();
  currentSuite = "Default";
}
