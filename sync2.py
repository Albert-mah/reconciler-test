"""Sync: live NocoBase → structure.yaml + state.yaml (reverse of deploy2).

Exports existing pages into the same layered format that deploy2 consumes.
Round-trip: sync → edit → deploy → sync = same result.

Usage:
    python sync2.py                         # list all routes
    python sync2.py "库存管理v2" inventory2/  # export group → module dir
    python sync2.py --page "产品管理" out/    # export single page
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import yaml
from nb import NocoBase, dump_yaml


def sync_list(nb: NocoBase):
    """List all routes."""
    routes = nb.routes()
    print("\n  Routes:\n")
    _print_routes(routes)
    print(f"\n  Usage: sync2.py \"Group Name\" <output_dir>")


def sync_group(nb: NocoBase, group_name: str, out_dir: str):
    """Export a group + its pages to structure.yaml + state.yaml."""
    routes = nb.routes()
    group = None
    for r in routes:
        if r.get("type") == "group" and r.get("title") == group_name:
            group = r
            break

    if not group:
        print(f"  Group '{group_name}' not found")
        sys.exit(1)

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    structure: dict[str, Any] = {
        "module": group_name,
        "icon": group.get("icon", "appstoreoutlined"),
        "pages": [],
    }
    state: dict[str, Any] = {
        "group_id": group["id"],
        "pages": {},
    }

    children = group.get("children", [])
    for child in children:
        if child.get("type") != "flowPage":
            continue
        title = child.get("title", "")
        tab_uid = _get_tab_uid(child)
        if not tab_uid:
            continue

        js_dir = out / "js"
        js_dir.mkdir(exist_ok=True)
        page_spec, page_state = _export_page(nb, title, child, tab_uid, js_dir)
        structure["pages"].append(page_spec)
        state["pages"][_slugify(title)] = page_state
        js_count = len(list(js_dir.glob("*.js")))
        print(f"  + {title} ({len(page_spec.get('blocks', []))} blocks, {js_count} js)")

    (out / "structure.yaml").write_text(dump_yaml(structure))
    (out / "state.yaml").write_text(dump_yaml(state))
    print(f"\n  Exported to {out}/")


def sync_page(nb: NocoBase, page_name: str, out_dir: str):
    """Export a single page."""
    routes = nb.routes()
    page_route = _find_page(routes, page_name)
    if not page_route:
        print(f"  Page '{page_name}' not found")
        sys.exit(1)

    tab_uid = _get_tab_uid(page_route)
    if not tab_uid:
        print(f"  Page '{page_name}' has no tab")
        sys.exit(1)

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    js_dir = out / "js"
    js_dir.mkdir(exist_ok=True)
    page_spec, page_state = _export_page(nb, page_name, page_route, tab_uid, js_dir)

    structure = {
        "module": page_name,
        "pages": [page_spec],
    }
    state = {
        "pages": {_slugify(page_name): page_state},
    }

    (out / "structure.yaml").write_text(dump_yaml(structure))
    (out / "state.yaml").write_text(dump_yaml(state))
    print(f"\n  Exported to {out}/")


def _export_page(nb: NocoBase, title: str, route: dict,
                 tab_uid: str, js_dir: Path = None) -> tuple[dict, dict]:
    """Export a page to spec + state format via flowSurfaces:get."""
    try:
        page_data = nb.get(tabSchemaUid=tab_uid)
    except Exception:
        page_data = {}

    page_spec: dict[str, Any] = {
        "page": title,
        "icon": route.get("icon", "fileoutlined"),
        "blocks": [],
    }
    page_state: dict[str, Any] = {
        "route_id": route.get("id"),
        "page_uid": route.get("schemaUid"),
        "tab_uid": tab_uid,
        "blocks": {},
    }

    # flowSurfaces:get returns {tree, nodeMap, ...}
    tree = page_data.get("tree", {})
    node_map = page_data.get("nodeMap", {})

    # Navigate: tree → subModels.grid → subModels.items
    grid = tree.get("subModels", {}).get("grid", {})
    items = grid.get("subModels", {}).get("items", [])
    if not isinstance(items, list):
        items = [items] if items else []

    for item in items:
        if not isinstance(item, dict):
            continue
        block_spec, block_key, block_state = _parse_block(item, js_dir)
        if block_spec:
            page_spec["blocks"].append(block_spec)
            page_state["blocks"][block_key] = block_state

    # Store grid UID
    if grid.get("uid"):
        page_state["grid_uid"] = grid["uid"]

    return page_spec, page_state


def _parse_block(item: dict, js_dir: Path = None) -> tuple[dict | None, str, dict]:
    """Parse a FlowModel block node to spec + state format.

    Returns (spec_dict, key, state_dict).
    If js_dir is provided, JS code is extracted to files.
    """
    use = item.get("use", "")
    uid = item.get("uid", "")
    sp = item.get("stepParams", {})
    subs = item.get("subModels", {})

    type_map = {
        "TableBlockModel": "table",
        "FilterFormBlockModel": "filterForm",
        "CreateFormModel": "createForm",
        "EditFormModel": "editForm",
        "DetailsBlockModel": "details",
        "ListBlockModel": "list",
        "JSBlockModel": "js",
        "GridCardBlockModel": "gridCard",
        "ChartBlockModel": "chart",
        "MarkdownBlockModel": "markdown",
    }

    btype = type_map.get(use)
    if not btype:
        return None, "", {}

    key = f"{btype}_{uid[:6]}"
    spec: dict[str, Any] = {"key": key, "type": btype}
    block_state: dict[str, Any] = {"uid": uid, "type": btype}

    # Collection
    coll = sp.get("resourceSettings", {}).get("init", {}).get("collectionName", "")
    if coll:
        spec["coll"] = coll

    # ── JS Block: extract code to file ──
    if btype == "js":
        code = sp.get("jsSettings", {}).get("runJs", {}).get("code", "")
        if code and js_dir:
            fname = f"{key}.js"
            (js_dir / fname).write_text(code)
            spec["file"] = f"./js/{fname}"
        return spec, key, block_state

    # ── Table: columns + JS columns + actions + record actions ──
    if btype == "table":
        fields, js_cols = _extract_table_fields(subs, js_dir, key)
        if fields:
            spec["fields"] = fields
        if js_cols:
            spec["js_columns"] = js_cols

        actions = _extract_actions(subs.get("actions", []))
        if actions:
            spec["actions"] = actions

        # Record actions (from TableActionsColumn)
        rec_actions = _extract_record_actions(subs)
        if rec_actions:
            spec["recordActions"] = rec_actions

        # Deep state: field UIDs
        block_state["fields"] = _extract_field_uids(subs)
        block_state["actions"] = _extract_action_uids(subs.get("actions", []))
        block_state["record_actions"] = _extract_record_action_uids(subs)
        if subs.get("actionsColumn"):
            block_state["actions_column_uid"] = subs["actionsColumn"].get("uid", "")

    # ── FilterForm: fields + layout ──
    elif btype == "filterForm":
        fields, layout = _extract_grid_fields(subs.get("grid", {}))
        if fields:
            spec["fields"] = fields
        if layout:
            spec["field_layout"] = layout
        block_state["fields"] = _extract_grid_field_uids(subs.get("grid", {}))
        if subs.get("grid", {}).get("uid"):
            block_state["grid_uid"] = subs["grid"]["uid"]

    # ── Form / Details: fields + layout ──
    elif btype in ("createForm", "editForm", "details"):
        fields, layout = _extract_grid_fields(subs.get("grid", {}))
        if fields:
            spec["fields"] = fields
        if layout:
            spec["field_layout"] = layout
        block_state["fields"] = _extract_grid_field_uids(subs.get("grid", {}))
        if subs.get("grid", {}).get("uid"):
            block_state["grid_uid"] = subs["grid"]["uid"]
        actions = _extract_actions(subs.get("actions", []))
        rec_actions_list = _extract_actions(subs.get("recordActions", []))
        if actions:
            spec["actions"] = actions
        if rec_actions_list:
            spec["recordActions"] = rec_actions_list

    return spec, key, block_state


def _extract_table_fields(subs: dict, js_dir: Path = None,
                           block_key: str = "") -> tuple[list, list]:
    """Extract fields and JS columns from table subModels."""
    fields = []
    js_cols = []
    columns = subs.get("columns", [])
    if not isinstance(columns, list):
        return fields, js_cols

    for col in columns:
        col_use = col.get("use", "")
        if col_use == "JSColumnModel":
            code = col.get("stepParams", {}).get("jsSettings", {}).get("runJs", {}).get("code", "")
            title = col.get("stepParams", {}).get("tableColumnSettings", {}).get("title", {}).get("title", "")
            entry: dict[str, Any] = {"uid": col.get("uid", "")}
            if title:
                entry["title"] = title
            if code and js_dir:
                safe = (title or col.get("uid", "")[:8]).replace(" ", "_").replace("/", "_")
                fname = f"{block_key}_col_{safe}.js"
                (js_dir / fname).write_text(code)
                entry["file"] = f"./js/{fname}"
            js_cols.append(entry)
        elif col_use == "TableActionsColumnModel":
            continue  # handled separately
        else:
            fp = col.get("stepParams", {}).get("fieldSettings", {}).get("init", {}).get("fieldPath", "")
            if fp:
                fields.append(fp)

    return fields, js_cols


def _extract_grid_fields(grid: dict) -> tuple[list, list | None]:
    """Extract fields and layout from a form/filter/detail grid."""
    if not isinstance(grid, dict):
        return [], None

    items = grid.get("subModels", {}).get("items", [])
    if not isinstance(items, list):
        return [], None

    fields = []
    for item in items:
        use = item.get("use", "")
        if "DividerItem" in use:
            label = item.get("stepParams", {}).get("markdownItemSetting", {}).get("title", {}).get("label", "")
            if label:
                fields.append(f"---{label}---")  # marker for layout reconstruction
            continue
        fp = item.get("stepParams", {}).get("fieldSettings", {}).get("init", {}).get("fieldPath", "")
        if fp:
            fields.append(fp)

    # Extract layout from gridSettings.rows
    gs = grid.get("stepParams", {}).get("gridSettings", {}).get("grid", {})
    rows = gs.get("rows", {})
    sizes = gs.get("sizes", {})
    row_order = gs.get("rowOrder", list(rows.keys()))

    if not rows:
        return [f for f in fields if not f.startswith("---")], None

    # Build uid → name map from items
    uid_to_name: dict[str, str] = {}
    for item in items:
        item_uid = item.get("uid", "")
        if "DividerItem" in item.get("use", ""):
            label = item.get("stepParams", {}).get("markdownItemSetting", {}).get("title", {}).get("label", "")
            uid_to_name[item_uid] = f"--- {label} ---"
        else:
            fp = item.get("stepParams", {}).get("fieldSettings", {}).get("init", {}).get("fieldPath", "")
            uid_to_name[item_uid] = fp or item_uid

    layout = []
    clean_fields = []
    for rk in row_order:
        cols = rows.get(rk, [])
        row_sizes = sizes.get(rk, [])
        row_items = []

        for i, col in enumerate(cols):
            if not col:
                continue
            uid = col[0] if col else ""
            name = uid_to_name.get(uid, uid)

            if name.startswith("--- "):
                layout.append(name)  # divider row
            else:
                size = row_sizes[i] if i < len(row_sizes) else 24 // len(cols)
                is_equal = (size == 24 // len(cols))
                if is_equal:
                    row_items.append(name)
                else:
                    row_items.append({name: size})
                if name and not name.startswith("---"):
                    clean_fields.append(name)

        if row_items:
            layout.append(row_items)

    return clean_fields or [f for f in fields if not f.startswith("---")], layout if layout else None


def _extract_field_uids(subs: dict) -> dict:
    """Extract field wrapper/field UIDs from table columns."""
    result = {}
    columns = subs.get("columns", [])
    if not isinstance(columns, list):
        return result
    for col in columns:
        fp = col.get("stepParams", {}).get("fieldSettings", {}).get("init", {}).get("fieldPath", "")
        if fp:
            field_child = col.get("subModels", {}).get("field", {})
            result[fp] = {
                "wrapper": col.get("uid", ""),
                "field": field_child.get("uid", "") if isinstance(field_child, dict) else "",
            }
        elif "JSColumn" in col.get("use", ""):
            title = col.get("stepParams", {}).get("tableColumnSettings", {}).get("title", {}).get("title", "")
            key = f"js_{title or col.get('uid','')[:6]}"
            result[key] = {"wrapper": col.get("uid", ""), "field": col.get("uid", "")}
    return result


def _extract_grid_field_uids(grid: dict) -> dict:
    """Extract field UIDs from form/filter/detail grid items."""
    result = {}
    if not isinstance(grid, dict):
        return result
    items = grid.get("subModels", {}).get("items", [])
    if not isinstance(items, list):
        return result
    for item in items:
        fp = item.get("stepParams", {}).get("fieldSettings", {}).get("init", {}).get("fieldPath", "")
        if fp:
            field_child = item.get("subModels", {}).get("field", {})
            result[fp] = {
                "wrapper": item.get("uid", ""),
                "field": field_child.get("uid", "") if isinstance(field_child, dict) else "",
            }
    return result


def _extract_actions(actions) -> list[str]:
    """Extract action types from action nodes."""
    action_map = {
        "FilterActionModel": "filter",
        "RefreshActionModel": "refresh",
        "AddNewActionModel": "addNew",
        "EditActionModel": "edit",
        "ViewActionModel": "view",
        "DeleteActionModel": "delete",
        "BulkDeleteActionModel": "bulkDelete",
        "ExportActionModel": "export",
        "ImportActionModel": "import",
        "LinkActionModel": "link",
        "FilterFormCollapseActionModel": "collapse",
        "FilterFormSubmitActionModel": "submit",
        "FilterFormResetActionModel": "reset",
        "FormSubmitActionModel": "submit",
    }
    if not isinstance(actions, list):
        return []
    result = []
    for act in actions:
        use = act.get("use", "")
        if "TableActionsColumn" in use:
            continue
        semantic = action_map.get(use, use.replace("Model", ""))
        result.append(semantic)
    return result


def _extract_action_uids(actions) -> dict:
    """Extract action UIDs."""
    if not isinstance(actions, list):
        return {}
    result = {}
    action_map = {
        "FilterActionModel": "filter", "RefreshActionModel": "refresh",
        "AddNewActionModel": "addNew", "ExportActionModel": "export",
        "ImportActionModel": "import", "BulkDeleteActionModel": "bulkDelete",
        "LinkActionModel": "link",
    }
    for act in actions:
        use = act.get("use", "")
        key = action_map.get(use)
        if key:
            result[key] = {"uid": act.get("uid", "")}
    return result


def _extract_record_actions(subs: dict) -> list[str]:
    """Extract record actions from TableActionsColumn."""
    action_map = {
        "EditActionModel": "edit", "ViewActionModel": "view",
        "DeleteActionModel": "delete", "DuplicateActionModel": "duplicate",
    }
    # Find TableActionsColumn
    for col in subs.get("columns", []):
        if "TableActionsColumn" in col.get("use", ""):
            acts = col.get("subModels", {}).get("actions", [])
            if isinstance(acts, list):
                return [action_map.get(a.get("use", ""), a.get("use", "").replace("Model", ""))
                        for a in acts]
    return []


def _extract_record_action_uids(subs: dict) -> dict:
    """Extract record action UIDs."""
    action_map = {
        "EditActionModel": "edit", "ViewActionModel": "view",
        "DeleteActionModel": "delete", "DuplicateActionModel": "duplicate",
    }
    for col in subs.get("columns", []):
        if "TableActionsColumn" in col.get("use", ""):
            acts = col.get("subModels", {}).get("actions", [])
            if isinstance(acts, list):
                return {action_map.get(a.get("use", ""), a.get("use", "")): {"uid": a.get("uid", "")}
                        for a in acts}
    return {}


# ── Helpers ──────────────────────────────────────────────────────

def _get_tab_uid(route: dict) -> str | None:
    for ch in route.get("children", []):
        if ch.get("type") == "tabs" and ch.get("schemaUid"):
            return ch["schemaUid"]
    return None


def _find_page(routes: list, name: str) -> dict | None:
    for r in routes:
        if r.get("title") == name and r.get("type") == "flowPage":
            return r
        children = r.get("children", [])
        found = _find_page(children, name)
        if found:
            return found
    return None


def _print_routes(routes: list, depth: int = 0):
    for r in routes:
        indent = "  " * depth
        rtype = r.get("type", "?")
        title = r.get("title", "(no title)")
        print(f"  {indent}{rtype:10s} {title}")
        _print_routes(r.get("children", []), depth + 1)


def _slugify(title: str) -> str:
    import re
    s = title.strip().lower()
    s = re.sub(r'[^a-z0-9\u4e00-\u9fff]+', '-', s)
    return s.strip('-') or title


# ── CLI ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    nb = NocoBase()

    if len(sys.argv) < 2:
        sync_list(nb)
        sys.exit(0)

    name = sys.argv[1]

    if name == "--page":
        page_name = sys.argv[2] if len(sys.argv) > 2 else ""
        out_dir = sys.argv[3] if len(sys.argv) > 3 else f"./{_slugify(page_name)}"
        sync_page(nb, page_name, out_dir)
    else:
        out_dir = sys.argv[2] if len(sys.argv) > 2 else f"./{_slugify(name)}"
        sync_group(nb, name, out_dir)
