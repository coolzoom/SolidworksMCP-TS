#!/usr/bin/env python3
"""Merge freecad entry into Cursor mcp.json (global and/or project)."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 4:
        print("usage: cursor_mcp_config.py <scope> <command> <args...>", file=sys.stderr)
        return 2

    scope = sys.argv[1]
    command = sys.argv[2]
    args = sys.argv[3:]

    entry = {"command": command, "args": args}
    targets: list[tuple[str, Path]] = []
    home = Path.home()
    repo = Path(os.environ.get("FREECAD_BENCH_REPO_ROOT", ".")).resolve()

    if scope in {"global", "both"}:
        targets.append(("Cursor global", home / ".cursor" / "mcp.json"))
    if scope in {"project", "both"}:
        targets.append(("Cursor project", repo / ".cursor" / "mcp.json"))

    configured = 0
    for label, path in targets:
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {"mcpServers": {}}
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                data = {"mcpServers": {}}
        servers = data.setdefault("mcpServers", {})
        servers["freecad"] = entry
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"[ OK ] {label}: {path}")
        configured += 1

    if configured == 0:
        print("[FAIL] Could not write any Cursor MCP config files.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
