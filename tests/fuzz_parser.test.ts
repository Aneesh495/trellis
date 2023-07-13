import { describe, it, assert } from "./framework.js";
import { Parser, decompile } from "@trellis/parser";
import { TrellisError } from "@trellis/core";

describe("Parser: Grammar Fuzzing and Invariant Roundtrips", () => {
  // Simple deterministic pseudorandom generator for reproducible fuzz tests
  let seed = 42;
  function random(): number {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }

  function randomInt(min: number, max: number): number {
    return Math.floor(random() * (max - min + 1)) + min;
  }

  const binaryOps = ["+", "-", "*", "/", "^", "&", "=", "<", ">", "<=", ">="];
  const funcs = ["SUM", "AVERAGE", "MIN", "MAX", "IF", "ABS", "ROUND"];

  function generateExpression(depth: number): string {
    if (depth <= 0 || random() < 0.3) {
      const type = randomInt(0, 3);
      if (type === 0) return String(randomInt(1, 100));
      if (type === 1) return `"${String.fromCharCode(65 + randomInt(0, 5))}"`;
      if (type === 2) return `${String.fromCharCode(65 + randomInt(0, 3))}${randomInt(1, 10)}`;
      return `${String.fromCharCode(65 + randomInt(0, 3))}${randomInt(1, 5)}:${String.fromCharCode(65 + randomInt(0, 3))}${randomInt(6, 10)}`;
    }

    const choice = randomInt(0, 3);
    if (choice === 0) {
      // Binary operator
      const op = binaryOps[randomInt(0, binaryOps.length - 1)]!;
      return `(${generateExpression(depth - 1)} ${op} ${generateExpression(depth - 1)})`;
    } else if (choice === 1) {
      // Function call
      const fn = funcs[randomInt(0, funcs.length - 1)]!;
      const argCount = randomInt(1, 3);
      const args: string[] = [];
      for (let i = 0; i < argCount; i++) {
        args.push(generateExpression(depth - 1));
      }
      return `${fn}(${args.join(", ")})`;
    } else if (choice === 2) {
      // Unary prefix
      return `(-${generateExpression(depth - 1)})`;
    } else {
      // Array literal
      const a = randomInt(1, 20);
      const b = randomInt(1, 20);
      return `{${a}, ${b}}`;
    }
  }

  it("successfully parses 200 randomized valid syntax trees and roundtrips via decompiler", () => {
    for (let i = 0; i < 200; i++) {
      const expr = `=${generateExpression(3)}`;
      try {
        const ast = Parser.parse(expr);
        assert(ast !== null, "AST should not be null");
        const decompiled = decompile(ast);
        assert(decompiled.length > 0, "Decompiled formula must not be empty");
        const ast2 = Parser.parse(`=${decompiled}`);
        assert(ast2 !== null, "Decompiled formula must parse successfully");
      } catch (err) {
        throw new Error(`Fuzz iteration ${i} failed for expression: ${expr}\nError: ${err}`);
      }
    }
  });

  it("gracefully catches syntax errors on malformed corrupted random strings without crashing", () => {
    const corruptChars = ["(", ")", ",", "\"", "'", "{", "}", "+", "*", "/", "!", "$", "%", "#", "^", "\n", "\0"];
    for (let i = 0; i < 250; i++) {
      // Generate mutated string
      let raw = generateExpression(2);
      const mutations = randomInt(1, 3);
      for (let m = 0; m < mutations; m++) {
        const pos = randomInt(0, raw.length);
        const c = corruptChars[randomInt(0, corruptChars.length - 1)]!;
        raw = raw.substring(0, pos) + c + raw.substring(pos);
      }

      try {
        Parser.parse(`=${raw}`);
      } catch (err) {
        // Expected parser error or TrellisError
        assert(err instanceof Error || err instanceof TrellisError, "Expected Error or TrellisError on malformed grammar");
      }
    }
  });
});
