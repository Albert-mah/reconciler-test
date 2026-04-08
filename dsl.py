"""NocoBase DSL — UID-centric, structure-as-truth.

The DSL file IS the source of truth. No separate state file needed.
- UIDs are identifiers (like variable names in code)
- Nesting = parent-child relationships
- Edit the DSL → apply → only changed nodes get updated
- New nodes (uid: null) → created, UID written back to file
- Nodes not in DSL → untouched

Usage:
    python dsl.py sync                     # List routes
    python dsl.py sync "Main"              # Export group → .dsl.yaml files
    python dsl.py sync --page "Leads"      # Export single page
    python dsl.py diff leads.dsl.yaml      # Show what would change
    python dsl.py apply leads.dsl.yaml     # Apply changes, write back UIDs
    python dsl.py inspect <uid>            # Show any UID's subtree
"""

from __future__ import annotations

import json
import os
import re
import sys
import random
import string
from pathlib import Path
from typing import Any, Optional

import requests
import yaml


# ── Helpers ────────────────────────────────────────────────────────

def gen_uid() -> str:
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=11))


def slugify(title: str) -> str:
    s = title.strip().lower()
    s = re.sub(r'[^a-z0-9\u4e00-\u9fff]+', '-', s)
    return s.strip('-') or title


# ── Minimal NocoBase Client ───────────────────────────────────────

class NB:
    def __init__(self):
        self.base = os.environ.get("NB_URL", "http://localhost:14000")
        self.s = requests.Session()
        self.s.trust_env = False
        self._timeout = 30
        self._login()
        self._models_cache: list[dict] | None = None

    def _login(self):
        account = os.environ.get("NB_USER", "admin@nocobase.com")
        password = os.environ.get("NB_PASSWORD", "admin123")
        r = self.s.post(f"{self.base}/api/auth:signIn",
                        json={"account": account, "password": password},
                        timeout=self._timeout)
        r.raise_for_status()
        self.s.headers["Authorization"] = f"Bearer {r.json()['data']['token']}"

    def get(self, path: str, **params):
        r = self.s.get(f"{self.base}/api/{path}", params=params, timeout=self._timeout)
        r.raise_for_status()
        return r.json().get("data")

    def post(self, path: str, body: dict = None):
        r = self.s.post(f"{self.base}/api/{path}", json=body, timeout=self._timeout)
        if not r.ok:
            raise RuntimeError(f"POST {path} → {r.status_code}: {r.text[:200]}")
        return r.json().get("data")

    def routes(self) -> list[dict]:
        return self.get("desktopRoutes:list", paginate="false", tree="true") or []

    def save_model(self, node: dict):
        return self.post("flowModels:save", node)

    def get_model(self, uid: str) -> dict | None:
        try:
            r = self.s.get(f"{self.base}/api/flowModels:get",
                           params={"filterByTk": uid}, timeout=self._timeout)
            if r.ok and r.text.strip():
                return r.json().get("data")
        except Exception:
            pass
        return None

    def destroy_model(self, uid: str):
        self.post(f"flowModels:destroy?filterByTk={uid}")

    def get_tree(self, parent_uid: str, sub_key: str = "grid") -> dict | None:
        r = self.s.get(f"{self.base}/api/flowModels:findOne",
                       params={"parentId": parent_uid, "subKey": sub_key},
                       timeout=self._timeout)
        if r.ok and r.text.strip():
            try:
                return r.json().get("data")
            except Exception:
                pass
        return None

    def all_models(self) -> list[dict]:
        if self._models_cache is None:
            self._models_cache = self.get("flowModels:list", paginate="false") or []
        return self._models_cache

    def children_of(self, parent_uid: str) -> list[dict]:
        return [m for m in self.all_models() if m.get("parentId") == parent_uid]

    def field_meta(self, coll: str) -> dict[str, dict]:
        fields = self.get(f"collections/{coll}/fields:list", pageSize="200") or []
        return {
            f["name"]: {
                "interface": f.get("interface", "input"),
                "type": f.get("type", "string"),
                "target": f.get("target", ""),
                "title": f.get("uiSchema", {}).get("title", f["name"]),
            }
            for f in fields
        }


# ── DSL ↔ Live Tree Conversion ────────────────────────────────────

def live_to_dsl(node: dict, nb: NB) -> dict:
    """Convert a live FlowModel node (with subModels) to DSL format.

    DSL format:
      uid: abc123
      use: TableBlockModel      (→ compacted to "TableBlock")
      coll: collection_name     (if has resourceSettings)
      field: field_path         (if has fieldSettings)
      popup: [uid, mode]        (if has popupSettings with external ref)
      <sub_key>:                (children, preserving structure)
        - uid: ...
    """
    use = node.get("use", "")
    uid = node.get("uid", "")
    sp = node.get("stepParams", {})

    # Compact model name: "TableBlockModel" → "TableBlock"
    short_use = use.replace("Model", "")

    entry: dict[str, Any] = {"uid": uid, "use": short_use}

    # Extract collection
    coll = sp.get("resourceSettings", {}).get("init", {}).get("collectionName", "")
    if coll:
        entry["coll"] = coll

    # Extract popup reference (don't follow — just record)
    popup = sp.get("popupSettings", {}).get("openView", {})
    popup_uid = popup.get("uid", "")
    popup_mode = popup.get("mode", "")
    if popup_uid and popup_uid != uid:  # skip self-refs
        entry["popup"] = [popup_uid, popup_mode]

    # Recurse into subModels first (before extracting field, to detect collision)
    subs = node.get("subModels", {})
    has_field_child = "field" in subs
    for key, val in subs.items():
        if isinstance(val, list) and val:
            entry[key] = [live_to_dsl(child, nb) for child in val]
        elif isinstance(val, dict) and "use" in val:
            entry[key] = live_to_dsl(val, nb)

    # Extract fieldPath — only as top-level shorthand if no child subKey collision
    field = sp.get("fieldSettings", {}).get("init", {}).get("fieldPath", "")
    if field and not has_field_child:
        entry["field"] = field

    # Preserve full stepParams for round-trip (but strip what we already extracted)
    extra_sp = _strip_extracted(sp)
    if extra_sp:
        entry["stepParams"] = extra_sp

    return entry


def _strip_extracted(sp: dict) -> dict:
    """Remove keys we already handle (resource, field, popup) from stepParams."""
    out = {}
    for k, v in sp.items():
        if k in ("resourceSettings", "fieldSettings", "popupSettings"):
            continue
        out[k] = v
    return out


def dsl_to_flat(dsl_node: dict, parent_uid: str, sub_key: str,
                sub_type: str, sort_index: int = 0) -> list[dict]:
    """Convert DSL node to flat FlowModel records for flowModels:save.

    Returns list of flat dicts, parent-first order.
    """
    uid = dsl_node.get("uid") or gen_uid()
    use = dsl_node.get("use", "")
    # Expand model name back: "TableBlock" → "TableBlockModel"
    if not use.endswith("Model"):
        use = use + "Model"

    # Rebuild stepParams
    sp = dict(dsl_node.get("stepParams", {}))

    coll = dsl_node.get("coll", "")
    if coll:
        sp.setdefault("resourceSettings", {})["init"] = {
            "dataSourceKey": "main", "collectionName": coll
        }

    field = dsl_node.get("field", "")
    if field:
        sp.setdefault("fieldSettings", {})["init"] = {
            "dataSourceKey": "main", "collectionName": coll or "",
            "fieldPath": field
        }

    popup = dsl_node.get("popup")
    if popup and isinstance(popup, list) and len(popup) == 2:
        sp.setdefault("popupSettings", {})["openView"] = {
            "uid": popup[0], "mode": popup[1],
            "collectionName": coll, "dataSourceKey": "main",
            "size": "large", "pageModelClass": "ChildPageModel",
        }

    record = {
        "uid": uid,
        "use": use,
        "parentId": parent_uid,
        "subKey": sub_key,
        "subType": sub_type,
        "sortIndex": sort_index,
        "stepParams": sp,
        "flowRegistry": {},
    }
    records = [record]

    # Write back the assigned UID for new nodes
    dsl_node["uid"] = uid

    # Recurse into children
    child_keys = [k for k in dsl_node
                  if k not in ("uid", "use", "coll", "field", "popup", "stepParams")]
    for ck in child_keys:
        val = dsl_node[ck]
        if isinstance(val, list):
            for i, child in enumerate(val):
                if isinstance(child, dict) and "use" in child:
                    records.extend(dsl_to_flat(child, uid, ck, "array", i))
        elif isinstance(val, dict) and "use" in val:
            records.extend(dsl_to_flat(val, uid, ck, "object", 0))

    return records


# ── Diff Engine ────────────────────────────────────────────────────

class DiffAction:
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    NOOP = "noop"


def diff_node(dsl_node: dict, live_node: dict | None) -> list[dict]:
    """Compare a DSL node against its live counterpart.

    Returns list of {action, uid, use, detail, dsl_node}.
    Only diffs this level — caller recurses children.
    """
    uid = dsl_node.get("uid")
    use = dsl_node.get("use", "")

    if not uid:
        # New node — needs creation
        return [{"action": DiffAction.CREATE, "uid": None, "use": use,
                 "detail": f"new {use}", "dsl_node": dsl_node}]

    if not live_node:
        # Has UID but doesn't exist in live → create (re-create)
        return [{"action": DiffAction.CREATE, "uid": uid, "use": use,
                 "detail": f"missing in live, will create", "dsl_node": dsl_node}]

    # Both exist — compare key properties
    changes = []
    live_sp = live_node.get("stepParams", {})
    dsl_sp = {}

    # Rebuild expected stepParams from DSL
    coll = dsl_node.get("coll", "")
    field = dsl_node.get("field", "")

    if coll:
        live_coll = live_sp.get("resourceSettings", {}).get("init", {}).get("collectionName", "")
        if live_coll != coll:
            changes.append(f"coll: {live_coll} → {coll}")

    # Only compare field if it's a string (fieldPath), not a child node dict
    if field and isinstance(field, str):
        live_field = live_sp.get("fieldSettings", {}).get("init", {}).get("fieldPath", "")
        if live_field != field:
            changes.append(f"field: {live_field} → {field}")

    # Check extra stepParams
    extra = dsl_node.get("stepParams", {})
    if extra:
        for k, v in extra.items():
            if live_sp.get(k) != v:
                changes.append(f"stepParams.{k} changed")

    if changes:
        return [{"action": DiffAction.UPDATE, "uid": uid, "use": use,
                 "detail": "; ".join(changes), "dsl_node": dsl_node}]

    return [{"action": DiffAction.NOOP, "uid": uid, "use": use,
             "detail": "unchanged"}]


def diff_tree(dsl_node: dict, nb: NB, parent_uid: str = None) -> list[dict]:
    """Recursively diff a DSL tree against live state.

    Returns flat list of diff items across the whole tree.
    """
    results = []
    uid = dsl_node.get("uid")

    # Get live node if UID exists
    live_node = nb.get_model(uid) if uid else None

    # Diff this node
    results.extend(diff_node(dsl_node, live_node))

    # Diff children
    child_keys = [k for k in dsl_node
                  if k not in ("uid", "use", "coll", "field", "popup", "stepParams")]
    for ck in child_keys:
        val = dsl_node[ck]
        if isinstance(val, list):
            for child in val:
                if isinstance(child, dict) and "use" in child:
                    results.extend(diff_tree(child, nb, uid))
        elif isinstance(val, dict) and "use" in val:
            results.extend(diff_tree(val, nb, uid))

    return results


# ── Sync (Live → DSL) ─────────────────────────────────────────────

def sync_page(nb: NB, tab_uid: str, title: str, route_id: int,
              page_uid: str = None) -> dict:
    """Read a live page and produce a DSL dict."""
    dsl = {
        "page": title,
        "tab": tab_uid,
        "route": route_id,
    }
    if page_uid:
        dsl["page_uid"] = page_uid

    tree = nb.get_tree(tab_uid)
    if tree:
        dsl["grid"] = live_to_dsl(tree, nb)

    return dsl


def sync_popup(nb: NB, uid: str) -> dict | None:
    """Read a popup/ChildPage subtree and produce DSL."""
    children = nb.children_of(uid)
    if not children:
        return None

    dsl: dict[str, Any] = {"popup": uid}
    for child in children:
        child_use = child.get("use", "").replace("Model", "")
        child_uid = child.get("uid")
        child_sk = child.get("subKey", "")

        child_entry: dict[str, Any] = {"uid": child_uid, "use": child_use}

        # For ChildPageTab, get its grid content
        if "Tab" in child_use:
            tab_tree = nb.get_tree(child_uid)
            if tab_tree:
                child_entry["grid"] = live_to_dsl(tab_tree, nb)

        dsl.setdefault(child_sk, [])
        if isinstance(dsl[child_sk], list):
            dsl[child_sk].append(child_entry)
        else:
            dsl[child_sk] = child_entry

    return dsl


def sync_routes(nb: NB, routes: list[dict], depth: int = 0,
                parent_group: str = None) -> list[dict]:
    """Flatten route tree for display."""
    result = []
    for r in routes:
        rtype = r.get("type", "?")
        title = r.get("title") or "(no title)"
        schema_uid = r.get("schemaUid")
        children = r.get("children", [])

        tab_uid = None
        if rtype == "flowPage":
            for ch in children:
                if ch.get("type") == "tabs" and ch.get("schemaUid"):
                    tab_uid = ch["schemaUid"]
                    break

        result.append({
            "id": r.get("id"),
            "type": rtype,
            "title": title,
            "schema_uid": schema_uid,
            "tab_uid": tab_uid,
            "depth": depth,
            "parent_group": parent_group,
        })

        if children:
            pg = title if rtype == "group" else parent_group
            result.extend(sync_routes(nb, children, depth + 1, pg))

    return result


# ── Apply (DSL → Live) ────────────────────────────────────────────

def apply_dsl(dsl_path: str, nb: NB, dry_run: bool = False) -> list[dict]:
    """Apply a DSL file to live NocoBase.

    For each node:
      - uid exists + unchanged → skip
      - uid exists + changed → update (flowModels:save)
      - uid null → create, write back uid to DSL
    """
    dsl = yaml.safe_load(Path(dsl_path).read_text())
    grid = dsl.get("grid")
    if not grid:
        print("  No grid in DSL, nothing to apply.")
        return []

    tab_uid = dsl.get("tab")
    if not tab_uid:
        print("  No tab uid in DSL.")
        return []

    # Diff
    diffs = diff_tree(grid, nb)

    creates = [d for d in diffs if d["action"] == DiffAction.CREATE]
    updates = [d for d in diffs if d["action"] == DiffAction.UPDATE]
    noops = [d for d in diffs if d["action"] == DiffAction.NOOP]

    print(f"\n  {len(creates)} create, {len(updates)} update, {len(noops)} unchanged\n")

    for d in diffs:
        sym = {"create": "+", "update": "~", "noop": "="}[d["action"]]
        uid_str = d["uid"] or "(new)"
        print(f"  {sym} {d['use']:30s} [{uid_str}]  {d['detail']}")

    if dry_run:
        return diffs

    if not creates and not updates:
        print("\n  Nothing to apply.")
        return diffs

    # Apply
    print(f"\n  Applying...")

    # Flatten DSL to flat records, then save each
    records = dsl_to_flat(grid, tab_uid, "grid", "object")

    applied = 0
    for rec in records:
        uid = rec["uid"]
        # Check if this node needs action
        node_diff = next((d for d in diffs if d.get("uid") == uid
                          or (d["action"] == DiffAction.CREATE
                              and d["dsl_node"].get("uid") == uid)),
                         None)

        if node_diff and node_diff["action"] in (DiffAction.CREATE, DiffAction.UPDATE):
            nb.save_model(rec)
            applied += 1

    # Write back UIDs to DSL file
    Path(dsl_path).write_text(
        yaml.dump(dsl, allow_unicode=True, default_flow_style=False,
                  sort_keys=False)
    )

    print(f"\n  Applied {applied} changes. UIDs written back to {dsl_path}")
    return diffs


# ── CLI ────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]
    nb = NB()

    if cmd == "sync":
        args = sys.argv[2:]
        page_only = "--page" in args
        name = None
        out_dir = "."
        for a in args:
            if a.startswith("--"):
                continue
            name = a

        routes = sync_routes(nb, nb.routes())

        if name is None:
            # List mode
            print("\n  Routes:\n")
            for r in routes:
                indent = "  " * r["depth"]
                print(f"  {indent}{r['type']:10s} {r['title']}")
            print(f"\n  Usage: sync \"Name\" to export DSL files")
            return

        # Find matching routes
        matched = [r for r in routes if r["title"] == name]
        if not matched:
            matched = [r for r in routes
                       if name.lower() in r["title"].lower()]
        if not matched:
            print(f"  No match for '{name}'")
            sys.exit(1)

        for r in matched:
            if r["type"] == "group" and not page_only:
                print(f"\n  Group: {r['title']}")
                # Export all child pages
                children = [cr for cr in routes
                            if cr.get("parent_group") == r["title"]
                            and cr["type"] == "flowPage"]
                for cp in children:
                    _export_page(nb, cp, out_dir)

            elif r["type"] == "flowPage":
                _export_page(nb, r, out_dir)

    elif cmd == "diff":
        dsl_path = sys.argv[2] if len(sys.argv) > 2 else None
        if not dsl_path:
            print("  Usage: diff <file.dsl.yaml>")
            sys.exit(1)
        apply_dsl(dsl_path, nb, dry_run=True)

    elif cmd == "apply":
        dsl_path = sys.argv[2] if len(sys.argv) > 2 else None
        if not dsl_path:
            print("  Usage: apply <file.dsl.yaml>")
            sys.exit(1)
        apply_dsl(dsl_path, nb)

    elif cmd == "inspect":
        uid = sys.argv[2] if len(sys.argv) > 2 else None
        if not uid:
            print("  Usage: inspect <uid>")
            sys.exit(1)

        # Try as popup parent
        popup_dsl = sync_popup(nb, uid)
        if popup_dsl:
            print(yaml.dump(popup_dsl, allow_unicode=True,
                           default_flow_style=False, sort_keys=False))
            return

        # Try as tree parent
        tree = nb.get_tree(uid)
        if tree:
            dsl = live_to_dsl(tree, nb)
            print(yaml.dump(dsl, allow_unicode=True,
                           default_flow_style=False, sort_keys=False))
            return

        # Try as single model
        model = nb.get_model(uid)
        if model:
            dsl = live_to_dsl(model, nb)
            print(yaml.dump(dsl, allow_unicode=True,
                           default_flow_style=False, sort_keys=False))
        else:
            print(f"  [{uid}] not found")

    else:
        print(f"  Unknown: {cmd}")
        print(__doc__)
        sys.exit(1)


def _export_page(nb: NB, route_info: dict, out_dir: str):
    """Export a single page to DSL YAML file."""
    title = route_info["title"]
    tab_uid = route_info.get("tab_uid")
    if not tab_uid:
        print(f"    SKIP {title}: no tab_uid")
        return

    dsl = sync_page(nb, tab_uid, title, route_info["id"],
                    route_info.get("schema_uid"))

    slug = slugify(title)
    path = Path(out_dir) / f"{slug}.dsl.yaml"
    path.write_text(yaml.dump(dsl, allow_unicode=True,
                              default_flow_style=False, sort_keys=False))

    block_count = _count_blocks(dsl.get("grid", {}))
    print(f"    → {path}  ({block_count} blocks)")


def _count_blocks(node: dict) -> int:
    """Count block-level nodes in a DSL tree."""
    count = 0
    use = node.get("use", "")
    if "Block" in use:
        count += 1
    for k, v in node.items():
        if k in ("uid", "use", "coll", "field", "popup", "stepParams"):
            continue
        if isinstance(v, list):
            for child in v:
                if isinstance(child, dict):
                    count += _count_blocks(child)
        elif isinstance(v, dict):
            count += _count_blocks(v)
    return count


if __name__ == "__main__":
    main()
