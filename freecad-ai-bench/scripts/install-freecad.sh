#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "${SCRIPT_DIR}/../lib/common.sh"

FORCE=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force|-Force) FORCE=true; shift ;;
    *) die "Unknown option: $1" ;;
  esac
done

write_step 'Checking FreeCAD installation'
if existing="$(find_freecadcmd 2>/dev/null || true)" && [[ -n "$existing" ]] && [[ "$FORCE" != true ]]; then
  write_ok "FreeCADCmd found: $existing"
  exit 0
fi

os="$(detect_os)"
write_step 'Installing FreeCAD'

if [[ "$os" == macos ]] && command -v brew >/dev/null 2>&1; then
  brew install --cask freecad
elif [[ "$os" == linux ]]; then
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y freecad
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y freecad
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -S --needed --noconfirm freecad || sudo pacman -S --needed freecad
  elif command -v brew >/dev/null 2>&1; then
    brew install --cask freecad
  else
    die 'No supported package manager found. Install FreeCAD from https://www.freecad.org/downloads.php'
  fi
else
  die 'Install FreeCAD manually: https://www.freecad.org/downloads.php (macOS: brew install --cask freecad)'
fi

sleep 2
hash -r 2>/dev/null || true
installed="$(find_freecadcmd || true)"
[[ -n "$installed" ]] || die 'FreeCAD install finished but freecadcmd was not found in PATH'
write_ok "FreeCAD installed: $installed"
