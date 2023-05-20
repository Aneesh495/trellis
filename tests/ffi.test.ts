import { describe, it, assert, assertEqual, assertCloseTo } from "./framework.js";
import { getNativeBridge } from "@trellis/ffi";

describe("TrellisFFI: Native SIMD Bridge", () => {
  it("should detect platform architecture and library capabilities", () => {
    const bridge = getNativeBridge();
    const caps = bridge.getCapabilities();

    assert(caps.architecture.length > 0, "Architecture must not be empty");
    assert(caps.platform.length > 0, "Platform must not be empty");
  });

  it("should calculate vectorized float64 aggregates with loop unrolling", () => {
    const bridge = getNativeBridge();
    const data = new Float64Array([1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5]);

    const sum = bridge.vectorSum(data);
    assertCloseTo(sum, 60.0, 1e-9);

    const mean = bridge.vectorMean(data);
    assertCloseTo(mean, 6.0, 1e-9);

    const minVal = bridge.vectorMin(data);
    assertCloseTo(minVal, 1.5, 1e-9);

    const maxVal = bridge.vectorMax(data);
    assertCloseTo(maxVal, 10.5, 1e-9);

    const dot = bridge.vectorDot(data, data);
    assertCloseTo(dot, 442.5, 1e-9);
  });

  it("should multiply and transpose matrices with cache-blocked algorithms", () => {
    const bridge = getNativeBridge();

    // A is 2x3: [[1, 2, 3], [4, 5, 6]]
    // B is 3x2: [[7, 8], [9, 1], [2, 3]]
    // C = A x B = [[31, 19], [85, 55]]
    const a = new Float64Array([1, 2, 3, 4, 5, 6]);
    const b = new Float64Array([7, 8, 9, 1, 2, 3]);

    const c = bridge.matrixMultiply(a, b, 2, 3, 2);
    assertEqual(c.length, 4);
    assertCloseTo(c[0]!, 31.0, 1e-9);
    assertCloseTo(c[1]!, 19.0, 1e-9);
    assertCloseTo(c[2]!, 85.0, 1e-9);
    assertCloseTo(c[3]!, 55.0, 1e-9);

    // Transpose A (2x3 -> 3x2)
    const at = bridge.matrixTranspose(a, 2, 3);
    assertEqual(at.length, 6);
    assertCloseTo(at[0]!, 1.0, 1e-9);
    assertCloseTo(at[1]!, 4.0, 1e-9);
    assertCloseTo(at[2]!, 2.0, 1e-9);
    assertCloseTo(at[3]!, 5.0, 1e-9);
    assertCloseTo(at[4]!, 3.0, 1e-9);
    assertCloseTo(at[5]!, 6.0, 1e-9);
  });

  it("should compute hardware Castagnoli CRC32-C matching known reference standard", () => {
    const bridge = getNativeBridge();
    const encoder = new TextEncoder();
    const testBytes = encoder.encode("123456789");

    const crc = bridge.crc32c(testBytes);
    assertEqual(crc, 0xE3069283);
  });
});
