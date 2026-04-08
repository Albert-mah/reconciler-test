"""Layout engine — convert human-readable layout DSL to NocoBase gridSettings.

Layout DSL format (used in structure.yaml):

  # Auto: equal width per row
  field_layout:
    - [name, category, status]       # 3 cols, each 8
    - [industry, owner]              # 2 cols, each 12
    - [remark]                       # 1 col, full 24

  # Explicit sizes
  field_layout:
    - [{name: 12}, {category: 6}, {status: 6}]
    - [remark]

  # Page-level block layout
  layout:
    - [filter]                       # full width
    - [{sidebar: 6}, {table: 18}]   # sidebar + table

Converts to NocoBase gridSettings:
  {grid: {rows: {row1: [[uid1],[uid2]], row2: [[uid3]]},
          sizes: {row1: [12,12], row2: [24]},
          rowOrder: [row1, row2]}}
"""

from __future__ import annotations

import random
import string
from typing import Any


def gen_row_id() -> str:
    """Short row ID."""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))


def build_grid(layout_spec: list[list], uid_map: dict[str, str]) -> dict:
    """Convert layout DSL + name→UID map to gridSettings.

    Args:
        layout_spec: list of rows, each row is list of items.
            Item can be: str (name) or dict {name: size}
        uid_map: mapping from item name to its UID

    Returns:
        gridSettings dict ready for setLayout or stepParams
    """
    rows = {}
    sizes = {}
    row_order = []

    for row_items in layout_spec:
        row_id = gen_row_id()
        row_cols = []
        row_sizes = []

        for item in row_items:
            if isinstance(item, dict):
                # Explicit size: {name: 12}
                name = list(item.keys())[0]
                size = item[name]
            elif isinstance(item, str):
                # Auto size: equal split
                name = item
                size = 24 // len(row_items)
            else:
                continue

            uid = uid_map.get(name, name)  # fallback to name if no mapping
            row_cols.append([uid])
            row_sizes.append(size)

        if row_cols:
            rows[row_id] = row_cols
            sizes[row_id] = row_sizes
            row_order.append(row_id)

    return {
        "gridSettings": {
            "grid": {
                "rows": rows,
                "sizes": sizes,
                "rowOrder": row_order,
            }
        }
    }


def auto_layout(uids: list[str], max_per_row: int = 3) -> dict:
    """Auto-generate horizontal layout: chunk UIDs into rows.

    Args:
        uids: list of UIDs to arrange
        max_per_row: max items per row (default 3)

    Returns:
        gridSettings dict
    """
    rows = {}
    sizes = {}
    row_order = []

    for i in range(0, len(uids), max_per_row):
        chunk = uids[i:i + max_per_row]
        row_id = gen_row_id()
        col_size = 24 // len(chunk)
        rows[row_id] = [[uid] for uid in chunk]
        sizes[row_id] = [col_size] * len(chunk)
        row_order.append(row_id)

    return {
        "gridSettings": {
            "grid": {
                "rows": rows,
                "sizes": sizes,
                "rowOrder": row_order,
            }
        }
    }


def parse_layout_spec(spec: list[list] | None, names: list[str],
                      max_per_row: int = 3) -> list[list]:
    """Normalize layout spec. If None, auto-generate from names.

    Returns normalized layout: list of rows, each row is list of str or dict.
    """
    if spec:
        return spec

    # Auto: chunk names into rows
    result = []
    for i in range(0, len(names), max_per_row):
        result.append(names[i:i + max_per_row])
    return result


def apply_layout(nb, grid_uid: str, layout_spec: list[list],
                 uid_map: dict[str, str]) -> bool:
    """Apply layout to a NocoBase grid via setLayout API.

    Args:
        nb: NocoBase client
        grid_uid: target grid UID
        layout_spec: parsed layout spec
        uid_map: name → UID mapping

    Returns:
        True if successful
    """
    grid = build_grid(layout_spec, uid_map)
    gs = grid["gridSettings"]["grid"]

    try:
        nb.set_layout(grid_uid, gs["rows"], gs["sizes"])
        return True
    except Exception as e:
        print(f"      ! layout failed: {e}")
        return False


def describe_layout(layout_spec: list[list]) -> str:
    """Human-readable layout description."""
    parts = []
    for i, row in enumerate(layout_spec):
        items = []
        for item in row:
            if isinstance(item, dict):
                name, size = list(item.items())[0]
                items.append(f"{name}:{size}")
            else:
                items.append(str(item))
        parts.append(f"[{', '.join(items)}]")
    return " | ".join(parts)
