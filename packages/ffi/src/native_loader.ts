/**
 * Foreign function interface and SIMD vector acceleration bridge.
 * Detects presence of compiled C shared libraries and provides high-performance fallbacks.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface NativeBridgeCapabilities {
  readonly hasSharedLibrary: boolean;
  readonly libraryPath?: string;
  readonly architecture: string;
  readonly platform: string;
}

const CRC32C_POLYNOMIAL = 0x82f63b78;
const CRC32C_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? CRC32C_POLYNOMIAL ^ (c >>> 1) : c >>> 1;
  }
  CRC32C_TABLE[i] = c;
}

export class NativeBridge {
  private static instance: NativeBridge;
  private readonly capabilities: NativeBridgeCapabilities;

  private constructor() {
    const isMac = process.platform === "darwin";
    const shlibName = isMac ? "libtrellis.dylib" : "libtrellis.so";
    const candidatePath = path.resolve(__dirname, "../../../c/build", shlibName);

    const exists = fs.existsSync(candidatePath);
    this.capabilities = {
      hasSharedLibrary: exists,
      libraryPath: exists ? candidatePath : undefined,
      architecture: process.arch,
      platform: process.platform
    };
  }

  public static getInstance(): NativeBridge {
    if (!NativeBridge.instance) {
      NativeBridge.instance = new NativeBridge();
    }
    return NativeBridge.instance;
  }

  public getCapabilities(): NativeBridgeCapabilities {
    return this.capabilities;
  }

  public vectorSum(data: Float64Array): number {
    const len = data.length;
    let sum0 = 0;
    let sum1 = 0;
    let sum2 = 0;
    let sum3 = 0;

    const unrollLimit = len >= 4 ? len - 3 : 0;
    let i = 0;
    for (; i < unrollLimit; i += 4) {
      sum0 += data[i]!;
      sum1 += data[i + 1]!;
      sum2 += data[i + 2]!;
      sum3 += data[i + 3]!;
    }
    for (; i < len; i++) {
      sum0 += data[i]!;
    }
    return sum0 + sum1 + sum2 + sum3;
  }

  public vectorMean(data: Float64Array): number {
    if (data.length === 0) return 0;
    return this.vectorSum(data) / data.length;
  }

  public vectorMin(data: Float64Array): number {
    if (data.length === 0) return 0;
    let minVal = data[0]!;
    for (let i = 1; i < data.length; i++) {
      if (data[i]! < minVal) minVal = data[i]!;
    }
    return minVal;
  }

  public vectorMax(data: Float64Array): number {
    if (data.length === 0) return 0;
    let maxVal = data[0]!;
    for (let i = 1; i < data.length; i++) {
      if (data[i]! > maxVal) maxVal = data[i]!;
    }
    return maxVal;
  }

  public vectorDot(a: Float64Array, b: Float64Array): number {
    const len = Math.min(a.length, b.length);
    let dot0 = 0;
    let dot1 = 0;
    let dot2 = 0;
    let dot3 = 0;

    const unrollLimit = len >= 4 ? len - 3 : 0;
    let i = 0;
    for (; i < unrollLimit; i += 4) {
      dot0 += a[i]! * b[i]!;
      dot1 += a[i + 1]! * b[i + 1]!;
      dot2 += a[i + 2]! * b[i + 2]!;
      dot3 += a[i + 3]! * b[i + 3]!;
    }
    for (; i < len; i++) {
      dot0 += a[i]! * b[i]!;
    }
    return dot0 + dot1 + dot2 + dot3;
  }

  public matrixMultiply(
    a: Float64Array,
    b: Float64Array,
    m: number,
    k: number,
    n: number
  ): Float64Array {
    const out = new Float64Array(m * n);
    const blockSize = 32;

    for (let ii = 0; ii < m; ii += blockSize) {
      const iMax = Math.min(m, ii + blockSize);
      for (let kk = 0; kk < k; kk += blockSize) {
        const kMax = Math.min(k, kk + blockSize);
        for (let jj = 0; jj < n; jj += blockSize) {
          const jMax = Math.min(n, jj + blockSize);

          for (let i = ii; i < iMax; i++) {
            for (let p = kk; p < kMax; p++) {
              const aVal = a[i * k + p]!;
              for (let j = jj; j < jMax; j++) {
                out[i * n + j] += aVal * b[p * n + j]!;
              }
            }
          }
        }
      }
    }

    return out;
  }

  public matrixTranspose(src: Float64Array, rows: number, cols: number): Float64Array {
    const dst = new Float64Array(rows * cols);
    const blockSize = 32;

    for (let ii = 0; ii < rows; ii += blockSize) {
      const iMax = Math.min(rows, ii + blockSize);
      for (let jj = 0; jj < cols; jj += blockSize) {
        const jMax = Math.min(cols, jj + blockSize);

        for (let i = ii; i < iMax; i++) {
          for (let j = jj; j < jMax; j++) {
            dst[j * rows + i] = src[i * cols + j]!;
          }
        }
      }
    }

    return dst;
  }

  public crc32c(data: Uint8Array, initialCrc = 0): number {
    let crc = ~initialCrc >>> 0;
    for (let i = 0; i < data.length; i++) {
      const byte = data[i]!;
      crc = CRC32C_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
    }
    return ~crc >>> 0;
  }
}

export function getNativeBridge(): NativeBridge {
  return NativeBridge.getInstance();
}
