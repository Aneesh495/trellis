"""
Unit tests for DataFrame interop and column dictionary conversions.
"""

import unittest
from trellis import Sheet, to_column_dict, from_column_dict, to_dataframe, from_dataframe


class TestDataFrameInterop(unittest.TestCase):
    def test_column_dict_roundtrip(self):
        records = {
            "Ticker": ["AAPL", "MSFT", "GOOG"],
            "Price": [180.5, 330.0, 135.2],
            "Volume": [10000, 25000, 15000]
        }

        sheet = from_column_dict(records, "Tickers")
        self.assertEqual(sheet.name, "Tickers")
        max_r, max_c = sheet.get_bounds()
        self.assertEqual(max_r, 3)
        self.assertEqual(max_c, 2)

        # Check headers
        self.assertEqual(sheet.get_cell(0, 0).value, "Ticker")
        self.assertEqual(sheet.get_cell(0, 1).value, "Price")
        self.assertEqual(sheet.get_cell(0, 2).value, "Volume")

        # Convert back
        recovered = to_column_dict(sheet)
        self.assertEqual(recovered["Ticker"], ["AAPL", "MSFT", "GOOG"])
        self.assertEqual(recovered["Price"], [180.5, 330.0, 135.2])
        self.assertEqual(recovered["Volume"], [10000, 25000, 15000])

    def test_dataframe_fallback(self):
        records = {"ColA": [1, 2], "ColB": [3, 4]}
        sheet = from_dataframe(records)
        df_result = to_dataframe(sheet)
        self.assertIsNotNone(df_result)


if __name__ == "__main__":
    unittest.main()
