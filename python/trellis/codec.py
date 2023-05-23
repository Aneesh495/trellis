"""
Binary .trellis serialization and deserialization with Castagnoli CRC32-C verification.
"""

import json
import struct
from typing import Dict, List, Any
from .models import Workbook, Sheet, Cell, CellCoord

MAGIC_BYTES = b"TRLS"
FORMAT_VERSION = 1
CRC32C_POLYNOMIAL = 0x82F63B78

# Precompute CRC32-C table
CRC32C_TABLE = []
for i in range(256):
    c = i
    for _ in range(8):
        c = (c >> 1) ^ CRC32C_POLYNOMIAL if (c & 1) else (c >> 1)
    CRC32C_TABLE.append(c)


def compute_crc32c(data: bytes, initial_crc: int = 0) -> int:
    crc = ~initial_crc & 0xFFFFFFFF
    for byte in data:
        crc = (crc >> 8) ^ CRC32C_TABLE[(crc ^ byte) & 0xFF]
    return ~crc & 0xFFFFFFFF


class BinaryCodec:
    @staticmethod
    def serialize(workbook: Workbook) -> bytes:
        manifest = {
            "version": FORMAT_VERSION,
            "sheets": []
        }

        for sheet in workbook.sheets:
            sheet_data = {
                "name": sheet.name,
                "cells": []
            }
            for cell in sheet.get_all_cells():
                sheet_data["cells"].append({
                    "r": cell.coord.row,
                    "c": cell.coord.col,
                    "raw": cell.raw,
                    "val": cell.value,
                    "f": cell.formula
                })
            manifest["sheets"].append(sheet_data)

        payload = json.dumps(manifest).encode("utf-8")
        length = len(payload)
        checksum = compute_crc32c(payload)

        # Header format: 4s (Magic) + I (Version) + I (Length) + I (CRC32-C)
        header = struct.pack("<4sIII", MAGIC_BYTES, FORMAT_VERSION, length, checksum)
        return header + payload

    @staticmethod
    def deserialize(data: bytes) -> Workbook:
        if len(data) < 16:
            raise ValueError("Invalid .trellis file: Header too short")

        magic, version, length, checksum = struct.unpack("<4sIII", data[:16])
        if magic != MAGIC_BYTES:
            raise ValueError(f"Invalid magic bytes: expected {MAGIC_BYTES}, got {magic}")

        if version != FORMAT_VERSION:
            raise ValueError(f"Unsupported format version: {version}")

        payload = data[16:16 + length]
        if len(payload) != length:
            raise ValueError(f"Truncated payload: expected {length} bytes, got {len(payload)}")

        calculated_checksum = compute_crc32c(payload)
        if calculated_checksum != checksum:
            raise ValueError(f"CRC32-C mismatch: expected {hex(checksum)}, computed {hex(calculated_checksum)}")

        manifest = json.loads(payload.decode("utf-8"))
        first_sheet_name = manifest["sheets"][0]["name"] if manifest["sheets"] else "Sheet1"
        workbook = Workbook(first_sheet_name)
        workbook.sheets = []

        for s_data in manifest["sheets"]:
            sheet = Sheet(s_data["name"])
            for c_data in s_data.get("cells", []):
                sheet.set_cell(
                    row=c_data["r"],
                    col=c_data["c"],
                    raw=c_data.get("raw", ""),
                    value=c_data.get("val"),
                    formula=c_data.get("f")
                )
            workbook.sheets.append(sheet)

        return workbook
