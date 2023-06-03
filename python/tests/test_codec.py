"""
Unit tests for Python BinaryCodec and Castagnoli CRC32-C.
"""

import unittest
from trellis import Workbook, BinaryCodec, compute_crc32c


class TestBinaryCodec(unittest.TestCase):
    def test_crc32c_reference_vector(self):
        # Known standard test vector "123456789" with Castagnoli CRC32-C yields 0xE3069283
        test_bytes = b"123456789"
        crc = compute_crc32c(test_bytes)
        self.assertEqual(crc, 0xE3069283)

    def test_serialization_roundtrip(self):
        wb = Workbook("Sheet1")
        sheet = wb.active_sheet
        sheet.set_cell(0, 0, "Revenue", 1000)
        sheet.set_cell(0, 1, "COGS", 400)
        sheet.set_cell(1, 0, "=A1-B1", 600, formula="=A1-B1")

        data = BinaryCodec.serialize(wb)
        self.assertTrue(len(data) > 16)
        self.assertEqual(data[:4], b"TRLS")

        loaded = BinaryCodec.deserialize(data)
        self.assertEqual(len(loaded.sheets), 1)
        loaded_sheet = loaded.active_sheet
        self.assertEqual(loaded_sheet.get_cell(0, 0).value, 1000)
        self.assertEqual(loaded_sheet.get_cell(0, 1).value, 400)
        self.assertEqual(loaded_sheet.get_cell(1, 0).formula, "=A1-B1")

    def test_corrupted_payload_detection(self):
        wb = Workbook("Sheet1")
        wb.active_sheet.set_cell(0, 0, "Val", 42)
        data = bytearray(BinaryCodec.serialize(wb))

        # Corrupt a byte in the payload
        data[-1] ^= 0xFF

        with self.assertRaises(ValueError) as ctx:
            BinaryCodec.deserialize(bytes(data))
        self.assertIn("CRC32-C mismatch", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
