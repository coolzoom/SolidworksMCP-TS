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

target="$(fasteners_mod_path)"
mod_root="$(dirname "$target")"
zip="${TMPDIR:-/tmp}/FreeCAD_FastenersWB.zip"
url='https://github.com/shaise/FreeCAD_FastenersWB/archive/refs/heads/master.zip'

write_step 'Checking Fasteners Workbench'
if [[ -d "$target" ]] && [[ "$FORCE" != true ]]; then
  write_ok "Fasteners already installed: $target"
  exit 0
fi

if [[ "$FORCE" == true ]] && [[ -d "$target" ]]; then
  write_warn "Removing existing Fasteners install: $target"
  rm -rf "$target"
fi

mkdir -p "$mod_root"
write_step 'Downloading Fasteners Workbench'
curl -fsSL "$url" -o "$zip"

write_step "Installing Fasteners to $target"
rm -rf "${mod_root}/FreeCAD_FastenersWB-master"
if command -v unzip >/dev/null 2>&1; then
  unzip -q "$zip" -d "$mod_root"
else
  python3 -c "import zipfile; zipfile.ZipFile('$zip').extractall('$mod_root')"
fi
extracted="${mod_root}/FreeCAD_FastenersWB-master"
[[ -d "$extracted" ]] || die 'Download archive did not contain FreeCAD_FastenersWB-master'
[[ -d "$target" ]] && rm -rf "$target"
mv "$extracted" "$target"
rm -f "$zip"
write_ok "Fasteners Workbench installed: $target"
