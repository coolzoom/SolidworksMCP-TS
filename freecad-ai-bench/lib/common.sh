#!/usr/bin/env bash
# Shared helpers for freecad-ai-bench (Linux / macOS)

set -euo pipefail

_bench_common_loaded=1

bench_root() {
  (cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
}

repo_root() {
  (cd "$(bench_root)/.." && pwd)
}

vendor_root() {
  echo "$(bench_root)/vendor/freecad-mcp"
}

write_step() { printf '\033[36m[STEP] %s\033[0m\n' "$*"; }
write_ok()   { printf '\033[32m[ OK ] %s\033[0m\n' "$*"; }
write_warn() { printf '\033[33m[WARN] %s\033[0m\n' "$*"; }
write_err()  { printf '\033[31m[FAIL] %s\033[0m\n' "$*" >&2; }

assert_last_exit() {
  local code=$1 step=$2
  if [[ "$code" -ne 0 ]]; then
    die "$step failed with exit code $code"
  fi
}

die() {
  write_err "$*"
  exit 1
}

detect_os() {
  case "$(uname -s)" in
    Darwin) echo macos ;;
    Linux)  echo linux ;;
    *)      echo unknown ;;
  esac
}

freecad_user_data_dir() {
  local os
  os="$(detect_os)"
  case "$os" in
    macos) echo "${HOME}/Library/Application Support/FreeCAD" ;;
    linux) echo "${XDG_DATA_HOME:-${HOME}/.local/share}/FreeCAD" ;;
    *)     echo "${HOME}/.local/share/FreeCAD" ;;
  esac
}

freecad_mod_roots() {
  local base data
  base="$(freecad_user_data_dir)"
  data=()
  [[ -d "${base}/v1-1/Mod" ]] && data+=("${base}/v1-1/Mod")
  [[ -d "${base}/Mod" ]] && data+=("${base}/Mod")
  [[ -d "${HOME}/.FreeCAD/Mod" ]] && data+=("${HOME}/.FreeCAD/Mod")
  [[ -d "${HOME}/snap/freecad/common/Mod" ]] && data+=("${HOME}/snap/freecad/common/Mod")
  if [[ ${#data[@]} -eq 0 ]]; then
    case "$(detect_os)" in
      macos) data+=("${base}/v1-1/Mod") ;;
      linux) data+=("${base}/Mod" "${HOME}/.FreeCAD/Mod") ;;
    esac
  fi
  printf '%s\n' "${data[@]}" | awk '!seen[$0]++'
}

fasteners_mod_path() {
  local root
  while IFS= read -r root; do
    if [[ -d "${root}/Fasteners" ]]; then
      echo "${root}/Fasteners"
      return 0
    fi
  done < <(freecad_mod_roots)
  echo "$(freecad_user_data_dir)/v1-1/Mod/Fasteners"
}

freecad_mcp_addon_path() {
  local root
  while IFS= read -r root; do
    if [[ -d "${root}/FreeCADMCP" ]]; then
      echo "${root}/FreeCADMCP"
      return 0
    fi
  done < <(freecad_mod_roots)
  echo "$(freecad_user_data_dir)/v1-1/Mod/FreeCADMCP"
}

find_freecadcmd() {
  local candidate
  for candidate in \
    "$(command -v freecadcmd 2>/dev/null || true)" \
    "$(command -v FreeCADCmd 2>/dev/null || true)" \
    "/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd" \
    "/Applications/FreeCAD.app/Contents/MacOS/freecadcmd" \
    "/opt/homebrew/bin/freecadcmd" \
    "/usr/local/bin/freecadcmd" \
    "/usr/bin/freecadcmd"; do
    [[ -n "$candidate" && -x "$candidate" ]] && { echo "$candidate"; return 0; }
  done
  return 1
}

find_freecad_gui() {
  local cmd bin name candidate
  if cmd="$(find_freecadcmd 2>/dev/null || true)"; then
    bin="$(dirname "$cmd")"
    for name in freecad FreeCAD; do
      candidate="${bin}/${name}"
      [[ -x "$candidate" ]] && { echo "$candidate"; return 0; }
    done
  fi
  [[ -x "/Applications/FreeCAD.app/Contents/MacOS/FreeCAD" ]] && {
    echo "/Applications/FreeCAD.app/Contents/MacOS/FreeCAD"
    return 0
  }
  for candidate in "$(command -v freecad 2>/dev/null || true)" "$(command -v FreeCAD 2>/dev/null || true)"; do
    [[ -n "$candidate" && -x "$candidate" ]] && { echo "$candidate"; return 0; }
  done
  return 1
}

find_git() {
  command -v git 2>/dev/null || true
}

find_uvx() {
  local candidate
  for candidate in \
    "$(command -v uvx 2>/dev/null || true)" \
    "${HOME}/.local/bin/uvx" \
    "${HOME}/.cargo/bin/uvx"; do
    [[ -n "$candidate" && -x "$candidate" ]] && { echo "$candidate"; return 0; }
  done
  return 1
}

find_uv() {
  local candidate
  for candidate in \
    "$(command -v uv 2>/dev/null || true)" \
    "${HOME}/.local/bin/uv" \
    "${HOME}/.cargo/bin/uv"; do
    [[ -n "$candidate" && -x "$candidate" ]] && { echo "$candidate"; return 0; }
  done
  return 1
}

find_python3() {
  command -v python3 2>/dev/null || command -v python 2>/dev/null || true
}

install_uv_toolchain() {
  if find_uvx >/dev/null 2>&1; then
    write_ok 'uvx already available'
    return 0
  fi
  write_step 'Installing uv (provides uvx for freecad-mcp)'
  if command -v brew >/dev/null 2>&1; then
    brew install uv
    hash -r 2>/dev/null || true
    find_uvx >/dev/null 2>&1 && { write_ok 'uv installed via Homebrew'; return 0; }
  fi
  local py
  py="$(find_python3)"
  if [[ -n "$py" ]]; then
    "$py" -m pip install --user --upgrade uv
    export PATH="${HOME}/.local/bin:${PATH}"
    find_uvx >/dev/null 2>&1 && { write_ok 'uv installed via pip'; return 0; }
  fi
  if curl -fsSL https://astral.sh/uv/install.sh | sh; then
    export PATH="${HOME}/.local/bin:${PATH}"
    find_uvx >/dev/null 2>&1 && { write_ok 'uv installed via install.sh'; return 0; }
  fi
  die 'Could not install uv/uvx. See https://docs.astral.sh/uv/getting-started/installation/'
}

bench_step() {
  local name=$1 script=$2
  shift 2
  printf '\n\033[35m========== %s ==========\033[0m\n' "$name"
  bash "$script" "$@"
  assert_last_exit $? "$name"
}
