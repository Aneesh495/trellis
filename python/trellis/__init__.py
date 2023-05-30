"""
Trellis Python SDK: Models, Binary Codec, DataFrame Interop, and Collaboration Client.
"""

from .models import CellCoord, RangeCoord, Cell, Sheet, Workbook
from .codec import BinaryCodec, compute_crc32c
from .dataframe import to_column_dict, from_column_dict, to_dataframe, from_dataframe
from .client import TrellisClient

__version__ = "1.0.0"
__all__ = [
    "CellCoord",
    "RangeCoord",
    "Cell",
    "Sheet",
    "Workbook",
    "BinaryCodec",
    "compute_crc32c",
    "to_column_dict",
    "from_column_dict",
    "to_dataframe",
    "from_dataframe",
    "TrellisClient",
]
