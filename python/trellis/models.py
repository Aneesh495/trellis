"""
Domain models for Trellis tabular workbooks, sparse cell grids, and coordinate geometry.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple


@dataclass(frozen=True)
class CellCoord:
    row: int
    col: int
    sheet: Optional[str] = None


@dataclass(frozen=True)
class RangeCoord:
    start_row: int
    start_col: int
    end_row: int
    end_col: int
    sheet: Optional[str] = None


@dataclass
class Cell:
    coord: CellCoord
    raw: str = ""
    value: Any = None
    formula: Optional[str] = None


class Sheet:
    def __init__(self, name: str):
        self.name: str = name
        self.cells: Dict[Tuple[int, int], Cell] = {}

    def get_cell(self, row: int, col: int) -> Optional[Cell]:
        return self.cells.get((row, col))

    def set_cell(self, row: int, col: int, raw: str, value: Any = None, formula: Optional[str] = None) -> Cell:
        cell = Cell(
            coord=CellCoord(row=row, col=col, sheet=self.name),
            raw=raw,
            value=value if value is not None else raw,
            formula=formula
        )
        self.cells[(row, col)] = cell
        return cell

    def get_all_cells(self) -> List[Cell]:
        return list(self.cells.values())

    def get_bounds(self) -> Tuple[int, int]:
        if not self.cells:
            return 0, 0
        max_r = max(r for r, _ in self.cells.keys())
        max_c = max(c for _, c in self.cells.keys())
        return max_r, max_c


class Workbook:
    def __init__(self, initial_sheet: str = "Sheet1"):
        self.sheets: List[Sheet] = []
        self.add_sheet(initial_sheet)

    def add_sheet(self, name: str) -> Sheet:
        for s in self.sheets:
            if s.name.lower() == name.lower():
                raise ValueError(f"Sheet '{name}' already exists in workbook")
        sheet = Sheet(name)
        self.sheets.append(sheet)
        return sheet

    def get_sheet(self, name: str) -> Optional[Sheet]:
        for s in self.sheets:
            if s.name.lower() == name.lower():
                return s
        return None

    @property
    def active_sheet(self) -> Sheet:
        return self.sheets[0]
