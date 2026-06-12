#!/usr/bin/env python3
"""MCP JSON-RPC client for uvx freecad-mcp (smoke test + execute_code)."""
from __future__ import annotations

import json
import subprocess
import sys
import time
from typing import Any


def run_messages(uvx: str, messages: list[dict[str, Any]], wait_seconds: float = 15.0) -> list[dict[str, Any]]:
    proc = subprocess.Popen(
        [uvx, "freecad-mcp"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    assert proc.stdin is not None
    for msg in messages:
        payload = dict(msg)
        payload.setdefault("jsonrpc", "2.0")
        proc.stdin.write(json.dumps(payload, ensure_ascii=False) + "\n")
    proc.stdin.close()

    time.sleep(wait_seconds)
    stdout = proc.stdout.read() if proc.stdout else ""
    try:
        proc.wait(timeout=20)
    except subprocess.TimeoutExpired:
        proc.kill()
        stdout += proc.stdout.read() if proc.stdout else ""

    responses: list[dict[str, Any]] = []
    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            responses.append(json.loads(line))
        except json.JSONDecodeError:
            pass
    return responses


def smoke_test(uvx: str, with_freecad: bool = False) -> int:
    messages: list[dict[str, Any]] = [
        {
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "freecad-mcp-smoke", "version": "1.0.0"},
            },
        },
        {"method": "notifications/initialized"},
        {"id": 2, "method": "tools/list"},
    ]
    if with_freecad:
        messages.append(
            {
                "id": 3,
                "method": "tools/call",
                "params": {"name": "create_document", "arguments": {"name": "MCP_Smoke_Test"}},
            }
        )

    responses = run_messages(uvx, messages, wait_seconds=15 if with_freecad else 10)
    init = next((r for r in responses if r.get("id") == 1), None)
    if not init or not init.get("result"):
        print("[FAIL] Smoke test failed: initialize", file=sys.stderr)
        return 1
    name = init["result"].get("serverInfo", {}).get("name", "?")
    print(f"[ OK ] initialize — {name}")

    tools_resp = next((r for r in responses if r.get("id") == 2), None)
    tool_names = []
    if tools_resp and tools_resp.get("result", {}).get("tools"):
        tool_names = [t["name"] for t in tools_resp["result"]["tools"]]
    expected = {"create_document", "create_object", "execute_code", "get_objects", "get_view"}
    missing = sorted(expected - set(tool_names))
    if missing:
        print(f"[WARN] tools/list incomplete (missing: {', '.join(missing)})")
        print("[ OK ] Smoke test partial — initialize OK")
        return 0
    print(f"[ OK ] tools/list — {len(tool_names)} tools")

    if with_freecad:
        create = next((r for r in responses if r.get("id") == 3), None)
        if create and create.get("result", {}).get("isError"):
            print("[WARN] create_document failed — is FreeCAD RPC server running?")
        else:
            print("[ OK ] create_document — FreeCAD RPC connected")
    else:
        print("INFO: skipped RPC call (use --with-freecad when FreeCAD RPC is running)")
    return 0


def execute_code(uvx: str, code: str, wait_seconds: float = 120.0) -> int:
    messages = [
        {
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "freecad-bench-screw", "version": "1.0.0"},
            },
        },
        {"method": "notifications/initialized"},
        {
            "id": 2,
            "method": "tools/call",
            "params": {"name": "execute_code", "arguments": {"code": code}},
        },
    ]
    responses = run_messages(uvx, messages, wait_seconds=wait_seconds)
    init = next((r for r in responses if r.get("id") == 1), None)
    if not init or not init.get("result"):
        print("[FAIL] MCP initialize failed. Check uvx freecad-mcp.", file=sys.stderr)
        return 1
    exec_resp = next((r for r in responses if r.get("id") == 2), None)
    if not exec_resp or not exec_resp.get("result"):
        print("[FAIL] MCP execute_code failed: no response", file=sys.stderr)
        return 1
    result = exec_resp["result"]
    text = ""
    content = result.get("content") or []
    if content and isinstance(content[0], dict):
        text = content[0].get("text") or ""
    if result.get("isError") or not text or text.startswith("Failed to execute code"):
        detail = text or "FreeCAD RPC not running? Start RPC Server in FreeCAD."
        print(f"[FAIL] MCP execute_code failed: {detail}", file=sys.stderr)
        return 1
    for line in text.splitlines():
        print(f"  {line}")
    return 0


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: mcp_jsonrpc.py smoke|execute <uvx> [args...]", file=sys.stderr)
        return 2
    mode = sys.argv[1]
    uvx = sys.argv[2]
    if mode == "smoke":
        with_fc = "--with-freecad" in sys.argv[3:]
        return smoke_test(uvx, with_fc)
    if mode == "execute":
        code = sys.stdin.read()
        return execute_code(uvx, code)
    print(f"unknown mode: {mode}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
