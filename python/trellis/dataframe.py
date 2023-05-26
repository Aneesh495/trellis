"""
Bidirectional DataFrame integration and columnar interop for Pandas, Polars, and dictionary records.
"""

from typing import Dict, List, Any, Union, Optional
from .models import Sheet, Workbook


def to_column_dict(sheet: Sheet, header_row: int = 0) -> Dict[str, List[Any]]:
    """
    Extracts sheet grid into a column-oriented dictionary representation.
    Row at header_row provides column names.
    """
    max_r, max_c = sheet.get_bounds()
    if not sheet.cells or max_r < header_row:
        return {}

    # Extract headers
    headers: List[str] = []
    for c in range(max_c + 1):
        cell = sheet.get_cell(header_row, c)
        header_name = str(cell.value) if cell and cell.value is not None else f"Column_{c}"
        headers.append(header_name)

    # Extract data rows
    data: Dict[str, List[Any]] = {h: [] for h in headers}

    for r in range(header_row + 1, max_r + 1):
        for c in range(max_c + 1):
            h = headers[c]
            cell = sheet.get_cell(r, c)
            val = cell.value if cell else None
            data[h].append(val)

    return data


def from_column_dict(data: Dict[str, List[Any]], sheet_name: str = "Sheet1") -> Sheet:
    """
    Constructs a Sheet from a column-oriented dictionary.
    """
    sheet = Sheet(sheet_name)
    headers = list(data.keys())

    # Write headers at row 0
    for c, h in enumerate(headers):
        sheet.set_cell(0, c, raw=str(h), value=str(h))

    # Write data rows
    for c, h in enumerate(headers):
        col_values = data[h]
        for r, val in enumerate(col_values):
            sheet.set_cell(r + 1, c, raw=str(val if val is not None else ""), value=val)

    return sheet


def to_dataframe(sheet: Sheet, library: str = "pandas") -> Any:
    """
    Converts a Sheet to a Pandas or Polars DataFrame if installed, falling back to dict.
    """
    col_dict = to_column_dict(sheet)

    if library.lower() == "pandas":
        try:
            import pandas as pd
            return pd.DataFrame(col_dict)
        except ImportError:
            return col_dict

    if library.lower() == "polars":
        try:
            import polars as pl
            return pl.DataFrame(col_dict)
        except ImportError:
            return col_dict

    return col_dict


def from_dataframe(df: Any, sheet_name: str = "Sheet1") -> Sheet:
    """
    Converts a Pandas DataFrame, Polars DataFrame, or dict into a Trellis Sheet.
    """
    # Check for Pandas DataFrame
    if hasattr(df, "to_dict"):
        try:
            col_dict = df.to_dict(orient="list")
            return from_column_dict(col_dict, sheet_name)
        except Exception:
            pass

    # Check for Polars DataFrame
    if hasattr(df, "to_dict"):
        try:
            col_dict = df.to_dict(as_series=False)
            return from_column_dict(col_dict, sheet_name)
        except Exception:
            pass

    if isinstance(df, dict):
        return from_column_dict(df, sheet_name)

    raise TypeError(f"Unsupported DataFrame type: {type(df)}")
