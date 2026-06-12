#!/usr/bin/env bash
# Unified freecad-ai-bench entry (FreeCAD + Fasteners + MCP) — Linux / macOS
#
#   ./freecad-mcp.sh              full setup (default)
#   ./freecad-mcp.sh help         list commands
#   ./freecad-mcp.sh mcp          MCP only
#   ./freecad-mcp.sh screw --size M5 --length 60
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

ACTION=setup
if [[ $# -gt 0 ]]; then
  case "$1" in
    help|Help|HELP|-h|--help|/\?) ACTION=help ;;
    *) ACTION=$1 ;;
  esac
fi

if [[ "$ACTION" != help && "$ACTION" != Help && "$ACTION" != HELP ]]; then
  shift || true
fi

bash "${ROOT}/scripts/freecad-mcp.sh" "$ACTION" "$@"
ec=$?

if [[ $ec -eq 0 && "$ACTION" != help && "$ACTION" != Help && "$ACTION" != HELP ]]; then
  printf '\n\033[32m[OK] freecad-ai-bench [%s] done.\033[0m\n' "$ACTION"
fi
exit $ec
