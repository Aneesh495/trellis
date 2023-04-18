/**
 * Zero-copy length-prefixed binary workbook serializer with Castagnoli CRC32 integrity verification.
 */

import { Workbook } from "./workbook.js";
import { Sheet } from "./sheet.js";
import { RangeCoord, TrellisError } from "@trellis/core";

const MAGIC_BYTES = new Uint8Array([0x54, 0x52, 0x4c, 0x53]); // "TRLS"
const FORMAT_VERSION = 1;

/**
 * Standard Castagnoli CRC32 table generator and checksum calculator.
 */
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0x82f63b78 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

export function computeCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i]!;
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export class BinaryCodec {
  /**
   * Serializes a Workbook into a binary .trellis buffer with CRC32 verification.
   */
  public static serialize(workbook: Workbook): Uint8Array {
    const encoder = new TextEncoder();

    // 1. Prepare JSON manifest containing sheets and cell contents
    const manifest = {
      version: FORMAT_VERSION,
      activeSheet: workbook.activeSheetIndex,
      options: workbook.calculationOptions,
      namedRanges: Array.from(workbook.namedRanges.entries()).map(([name, range]) => ({
        name,
        range
      })),
      sheets: workbook.sheets.map((s) => ({
        name: s.name,
        freezeRows: s.freezeRows,
        freezeCols: s.freezeCols,
        cells: s.getAllCells().map((c) => ({
          r: c.coord.row,
          c: c.coord.col,
          raw: c.raw,
          v: c.value
        }))
      }))
    };

    const payloadBytes = encoder.encode(JSON.stringify(manifest));
    const crc = computeCrc32(payloadBytes);

    // Total size: 4 (magic) + 2 (version) + 4 (crc) + 4 (payloadLength) + payload
    const totalSize = 14 + payloadBytes.length;
    const output = new Uint8Array(totalSize);
    const view = new DataView(output.buffer);

    // Write Magic Bytes
    output.set(MAGIC_BYTES, 0);

    // Write Version
    view.setUint16(4, FORMAT_VERSION, true);

    // Write CRC32
    view.setUint32(6, crc, true);

    // Write Payload Length
    view.setUint32(10, payloadBytes.length, true);

    // Write Payload
    output.set(payloadBytes, 14);

    return output;
  }

  /**
   * Deserializes a binary .trellis buffer into a Workbook, validating header and CRC32 checksum.
   */
  public static deserialize(buffer: Uint8Array): Workbook {
    if (buffer.length < 14) {
      throw TrellisError.valueError("Binary buffer too short to contain valid Trellis header");
    }

    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    // Verify magic bytes
    for (let i = 0; i < 4; i++) {
      if (buffer[i] !== MAGIC_BYTES[i]) {
        throw TrellisError.valueError("Invalid magic bytes in Trellis binary file header");
      }
    }

    const version = view.getUint16(4, true);
    if (version !== FORMAT_VERSION) {
      throw TrellisError.valueError(`Unsupported Trellis binary version: ${version}`);
    }

    const expectedCrc = view.getUint32(6, true);
    const payloadLength = view.getUint32(10, true);

    if (buffer.length < 14 + payloadLength) {
      throw TrellisError.valueError("Truncated binary buffer payload");
    }

    const payload = buffer.subarray(14, 14 + payloadLength);
    const actualCrc = computeCrc32(payload);

    if (actualCrc !== expectedCrc) {
      throw TrellisError.valueError(
        `CRC32 integrity verification failed (expected 0x${expectedCrc.toString(16)}, got 0x${actualCrc.toString(16)})`
      );
    }

    const decoder = new TextDecoder();
    const manifest = JSON.parse(decoder.decode(payload));

    const workbook = new Workbook(manifest.sheets[0]?.name || "Sheet1");
    workbook.clear();

    workbook.activeSheetIndex = manifest.activeSheet || 0;
    workbook.calculationOptions = manifest.options || { ...workbook.calculationOptions };

    if (manifest.namedRanges) {
      for (const nr of manifest.namedRanges) {
        workbook.setNamedRange(nr.name, nr.range as RangeCoord);
      }
    }

    for (const sData of manifest.sheets) {
      const sheet = new Sheet(sData.name);
      sheet.freezeRows = sData.freezeRows || 0;
      sheet.freezeCols = sData.freezeCols || 0;

      for (const cData of sData.cells) {
        const cell = sheet.getOrCreateCell(cData.r, cData.c);
        cell.setInput(cData.raw);
        if (cData.v !== undefined) {
          cell.value = cData.v;
        }
      }

      workbook.sheets.push(sheet);
    }

    return workbook;
  }
}
