#!/usr/bin/env bash
# Unified FreeCAD + Fasteners + MCP bench (Linux / macOS)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "${SCRIPT_DIR}/../lib/common.sh"

BENCH_ROOT="$(bench_root)"
REPO_ROOT="$(repo_root)"
VENDOR_ROOT="$(vendor_root)"
ADDON_SRC="${VENDOR_ROOT}/addon/FreeCADMCP"

ACTION=setup
CURSOR_SCOPE=both
SKIP_CLONE=false
SKIP_UV=false
SKIP_CURSOR_CONFIG=false
DEV_MODE=false
LAUNCH_FREECAD=false
WITH_FREECAD=false
SKIP_FREECAD_INSTALL=false
SKIP_FASTENERS_INSTALL=false
SKIP_MCP_INSTALL=false
SKIP_TESTS=false
FORCE_FREECAD=false
FORCE_FASTENERS=false
REPO_URL='https://github.com/neka-nat/freecad-mcp.git'
SIZE=M3
LENGTH=20
SCREW_OUTPUT=''
REAL_THREAD=false
SIMPLE_THREAD=false
NO_THREAD=false

normalize_action() {
  case "$ACTION" in
    all|install) ACTION=mcp ;;
    test) ACTION=test-mcp ;;
  esac
}

parse_args() {
  if [[ $# -gt 0 ]]; then
    ACTION=$1
    shift
  fi
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --cursor-scope|-CursorScope) CURSOR_SCOPE=$2; shift 2 ;;
      --skip-clone|-SkipClone) SKIP_CLONE=true; shift ;;
      --skip-uv|-SkipUv) SKIP_UV=true; shift ;;
      --skip-cursor-config|-SkipCursorConfig) SKIP_CURSOR_CONFIG=true; shift ;;
      --dev-mode|-DevMode) DEV_MODE=true; shift ;;
      --launch-freecad|-LaunchFreeCad) LAUNCH_FREECAD=true; shift ;;
      --with-freecad|-WithFreeCad) WITH_FREECAD=true; shift ;;
      --skip-freecad-install|-SkipFreeCadInstall) SKIP_FREECAD_INSTALL=true; shift ;;
      --skip-fasteners-install|-SkipFastenersInstall) SKIP_FASTENERS_INSTALL=true; shift ;;
      --skip-mcp-install|-SkipMcpInstall) SKIP_MCP_INSTALL=true; shift ;;
      --skip-tests|-SkipTests) SKIP_TESTS=true; shift ;;
      --force-freecad|-ForceFreeCad) FORCE_FREECAD=true; shift ;;
      --force-fasteners|-ForceFasteners) FORCE_FASTENERS=true; shift ;;
      --repo-url|-RepoUrl) REPO_URL=$2; shift 2 ;;
      --size|-Size) SIZE=$2; shift 2 ;;
      --length|-Length) LENGTH=$2; shift 2 ;;
      --screw-output|-ScrewOutput) SCREW_OUTPUT=$2; shift 2 ;;
      --real-thread|-RealThread) REAL_THREAD=true; shift ;;
      --simple-thread|-SimpleThread) SIMPLE_THREAD=true; shift ;;
      --no-thread|-NoThread) NO_THREAD=true; shift ;;
      help|-h|--help|/?) ACTION=help; shift ;;
      *) die "Unknown option: $1" ;;
    esac
  done
  normalize_action
}

show_help() {
  cat <<'EOF'

freecad-mcp.sh commands:
  setup          Full install + tests (default)
  freecad        Install FreeCAD (brew / apt / dnf / pacman)
  fasteners      Install Fasteners Workbench
  init-fasteners Verify Fasteners / ISO4762
  mcp            neka-nat/freecad-mcp + Cursor config
  config         Cursor mcp.json only
  verify         MCP health check
  test-mcp       MCP smoke test
  test-model     Generate M3x20 screw via FreeCADCmd (setup default test)
  screw          Generate screw via MCP execute_code (FreeCAD RPC required)
  help           This help

Examples:
  ./freecad-mcp.sh
  ./freecad-mcp.sh mcp
  ./freecad-mcp.sh test-model --size M3 --length 20
  ./freecad-mcp.sh screw --size M5 --length 60   (FreeCAD RPC server must be running)

Note: always use --size M3 and --length 20 (Length is mm, not M3).
      PowerShell-style -Size / -Length flags are also accepted.

EOF
}

install_freecad_mcp_repo() {
  if [[ -d "${VENDOR_ROOT}/addon/FreeCADMCP" ]]; then
    write_ok "Repository already present: ${VENDOR_ROOT}"
    return 0
  fi
  local git_bin
  git_bin="$(find_git || true)"
  if [[ -n "$git_bin" ]] && [[ ! -d "${VENDOR_ROOT}/.git" ]]; then
    rm -rf "$VENDOR_ROOT"
    write_step "Cloning ${REPO_URL}"
    mkdir -p "$(dirname "$VENDOR_ROOT")"
    if "$git_bin" clone "$REPO_URL" "$VENDOR_ROOT"; then
      write_ok "Repository: ${VENDOR_ROOT}"
      return 0
    fi
    write_warn 'git clone failed; trying ZIP download fallback'
    rm -rf "$VENDOR_ROOT"
  elif [[ -n "$git_bin" ]] && [[ -d "${VENDOR_ROOT}/.git" ]]; then
    write_step 'Updating freecad-mcp repository'
    if "$git_bin" -C "$VENDOR_ROOT" pull --ff-only; then
      write_ok "Repository updated: ${VENDOR_ROOT}"
      return 0
    fi
    write_warn 'git pull failed; continuing with existing clone'
    return 0
  fi

  write_step 'Downloading freecad-mcp ZIP (main branch)'
  local zip extract_root
  zip="${TMPDIR:-/tmp}/freecad-mcp-main.zip"
  extract_root="${TMPDIR:-/tmp}/freecad-mcp-main"
  curl -fsSL 'https://github.com/neka-nat/freecad-mcp/archive/refs/heads/main.zip' -o "$zip"
  rm -rf "$extract_root"
  if command -v unzip >/dev/null 2>&1; then
    unzip -q "$zip" -d "${TMPDIR:-/tmp}"
  else
    python3 -c "import zipfile; zipfile.ZipFile('$zip').extractall('${TMPDIR:-/tmp}')"
  fi
  rm -rf "$VENDOR_ROOT"
  mkdir -p "$(dirname "$VENDOR_ROOT")"
  mv "$extract_root" "$VENDOR_ROOT"
  rm -f "$zip"
  write_ok "Repository extracted: ${VENDOR_ROOT}"
}

install_freecad_mcp_addon() {
  [[ -d "$ADDON_SRC" ]] || die "Addon source missing: ${ADDON_SRC}"
  write_step 'Installing FreeCADMCP addon into FreeCAD Mod directories'
  local root
  while IFS= read -r root; do
    mkdir -p "$root"
    rm -rf "${root}/FreeCADMCP"
    cp -R "$ADDON_SRC" "${root}/FreeCADMCP"
    write_ok "Addon installed: ${root}/FreeCADMCP"
  done < <(freecad_mod_roots)
}

install_freecad_mcp_package() {
  install_uv_toolchain
  local uvx
  uvx="$(find_uvx || true)"
  [[ -n "$uvx" ]] || die 'uvx not found after uv install'
  write_ok "uvx: $uvx"
  write_step 'Prefetch freecad-mcp package via uvx'
  if "$uvx" freecad-mcp --help >/dev/null 2>&1; then
    write_ok 'freecad-mcp package ready via uvx'
  else
    write_warn 'uvx freecad-mcp --help returned non-zero; package may still work in Cursor'
  fi
}

set_cursor_freecad_mcp_config() {
  local command mode
  local -a args=()
  if [[ "$DEV_MODE" == true ]]; then
    [[ -d "$VENDOR_ROOT" ]] || die "Dev mode requires vendor clone: ${VENDOR_ROOT}"
    command="$(find_uv || true)"
    [[ -n "$command" ]] || die 'uv not found for dev mode'
    args=(--directory "$VENDOR_ROOT" run freecad-mcp)
    mode=dev
  else
    command="$(find_uvx || true)"
    [[ -n "$command" ]] || die 'uvx not found. Run with action mcp first.'
    args=(freecad-mcp)
    mode=uvx
  fi
  write_step "Configuring Cursor MCP (scope: ${CURSOR_SCOPE}, mode: ${mode})"
  echo "  Command: ${command}"
  echo "  Args:    ${args[*]}"
  FREECAD_BENCH_REPO_ROOT="$REPO_ROOT" python3 "${BENCH_ROOT}/lib/cursor_mcp_config.py" \
    "$CURSOR_SCOPE" "$command" "${args[@]}"
}

test_freecad_mcp_environment() {
  local ok=true
  local addon
  addon="$(freecad_mcp_addon_path)"
  if [[ -d "$addon" ]]; then
    write_ok "FreeCADMCP addon: $addon"
  else
    write_err "FreeCADMCP addon missing: $addon"
    ok=false
  fi
  if [[ -d "$VENDOR_ROOT" ]]; then
    write_ok "Upstream source: ${VENDOR_ROOT}"
  else
    write_warn "Upstream source missing: ${VENDOR_ROOT}"
  fi
  local uvx gui
  if uvx="$(find_uvx || true)" && [[ -n "$uvx" ]]; then
    write_ok "uvx: $uvx"
  else
    write_err 'uvx not found'
    ok=false
  fi
  if gui="$(find_freecad_gui || true)" && [[ -n "$gui" ]]; then
    write_ok "FreeCAD GUI: $gui"
  else
    write_warn 'FreeCAD GUI not found'
  fi
  [[ "$ok" == true ]]
}

show_freecad_mcp_usage() {
  cat <<'EOF'

Manual steps (once per FreeCAD session):
  1. Open FreeCAD
  2. Workbench -> MCP Addon (FreeCADMCP)
  3. Toolbar -> Start RPC Server
  4. Optional: MCP menu -> Auto-Start Server
  5. Cursor -> MCP: Reload Servers

Docs: https://github.com/neka-nat/freecad-mcp
EOF
}

invoke_mcp_smoke_test() {
  local uvx
  uvx="$(find_uvx || true)"
  [[ -n "$uvx" ]] || die 'uvx not found'
  write_step 'MCP smoke test (initialize + tools/list)'
  local -a extra=()
  [[ "$WITH_FREECAD" == true ]] && extra+=(--with-freecad)
  python3 "${BENCH_ROOT}/lib/mcp_jsonrpc.py" smoke "$uvx" "${extra[@]}"
}

get_screw_mcp_execute_code() {
  local py_script=$1 size=$2 length=$3 output_path=$4 thread_mode=$5
  py_script="${py_script//\\//}"
  output_path="${output_path//\\//}"
  local len_text=$length
  [[ "$length" =~ ^[0-9]+$ ]] && len_text=$length
  cat <<PYCODE
import os
os.environ['SCREW_SIZE'] = '${size}'
os.environ['SCREW_LENGTH'] = '${len_text}'
os.environ['SCREW_THREAD'] = '${thread_mode}'
os.environ['SCREW_OUTPUT'] = r'${output_path}'
_path = r'${py_script}'
with open(_path, encoding='utf-8') as _f:
    _src = _f.read()
if 'raise SystemExit(main())' in _src:
    _src = _src.replace('raise SystemExit(main())', 'main()', 1)
exec(compile(_src, _path, 'exec'), {'__name__': '__main__', '__file__': _path})
PYCODE
}

invoke_freecad_screw_via_mcp() {
  local py_script="${BENCH_ROOT}/python/freecad-iso4762-screw.py"
  [[ -f "$py_script" ]] || die "Missing generator: ${py_script}"

  local out_dir="${BENCH_ROOT}/output"
  mkdir -p "$out_dir"
  local suffix=iso4762_threaded
  if [[ "$SIMPLE_THREAD" == true || "$NO_THREAD" == true ]]; then suffix=iso4762; fi
  if [[ -z "$SCREW_OUTPUT" ]]; then
    SCREW_OUTPUT="${out_dir}/${SIZE}x${LENGTH}_${suffix}.FCStd"
  fi
  mkdir -p "$(dirname "$SCREW_OUTPUT")"
  SCREW_OUTPUT="$(cd "$(dirname "$SCREW_OUTPUT")" && pwd)/$(basename "$SCREW_OUTPUT")"

  local thread_mode=real
  if [[ "$NO_THREAD" == true ]]; then thread_mode=none
  elif [[ "$SIMPLE_THREAD" == true ]]; then thread_mode=simple
  fi

  local uvx
  uvx="$(find_uvx || true)"
  [[ -n "$uvx" ]] || die 'uvx not found. Run: ./freecad-mcp.sh mcp'

  write_step "MCP execute_code: generating screw ${SIZE}x${LENGTH} (requires FreeCAD RPC server)"
  echo '  Ensure FreeCAD is open -> MCP Addon -> Start RPC Server'

  local code
  code="$(get_screw_mcp_execute_code "$py_script" "$SIZE" "$LENGTH" "$SCREW_OUTPUT" "$thread_mode")"
  python3 "${BENCH_ROOT}/lib/mcp_jsonrpc.py" execute "$uvx" <<<"$code"
  assert_last_exit $? 'MCP execute_code'

  local step_file="${SCREW_OUTPUT%.FCStd}.step"
  for file in "$SCREW_OUTPUT" "$step_file"; do
    [[ -f "$file" ]] || die "Expected output missing after MCP run: $file"
    local bytes
    bytes=$(wc -c <"$file" | tr -d ' ')
    [[ "$bytes" -ge 512 ]] || die "Output too small ($bytes bytes): $file"
    write_ok "$file ($bytes bytes)"
  done
}

invoke_mcp_setup() {
  write_step 'MCP setup: neka-nat/freecad-mcp + Cursor config'
  [[ "$SKIP_CLONE" == true ]] || install_freecad_mcp_repo
  install_freecad_mcp_addon
  [[ "$SKIP_UV" == true ]] || install_freecad_mcp_package
  test_freecad_mcp_environment || die 'MCP environment check failed'
  [[ "$SKIP_CURSOR_CONFIG" == true ]] || set_cursor_freecad_mcp_config
  show_freecad_mcp_usage
  if [[ "$LAUNCH_FREECAD" == true ]]; then
    local gui
    gui="$(find_freecad_gui || true)"
    [[ -n "$gui" ]] && "$gui" &
  fi
  write_ok 'MCP setup complete'
}

invoke_full_setup() {
  if [[ "$SKIP_FREECAD_INSTALL" != true ]]; then
    if [[ "$FORCE_FREECAD" == true ]]; then
      bench_step 'Install FreeCAD' "${SCRIPT_DIR}/install-freecad.sh" --force
    else
      bench_step 'Install FreeCAD' "${SCRIPT_DIR}/install-freecad.sh"
    fi
  fi
  if [[ "$SKIP_FASTENERS_INSTALL" != true ]]; then
    if [[ "$FORCE_FASTENERS" == true ]]; then
      bench_step 'Install Fasteners Workbench' "${SCRIPT_DIR}/install-fasteners.sh" --force
    else
      bench_step 'Install Fasteners Workbench' "${SCRIPT_DIR}/install-fasteners.sh"
    fi
    bench_step 'Initialize Fasteners Workbench' "${SCRIPT_DIR}/init-fasteners.sh"
  fi
  [[ "$SKIP_MCP_INSTALL" == true ]] || invoke_mcp_setup
  if [[ "$SKIP_TESTS" != true ]]; then
    bench_step 'Test FreeCAD screw model' "${SCRIPT_DIR}/test-freecad-model.sh" --size "$SIZE" --length "$LENGTH"
    [[ "$SKIP_CURSOR_CONFIG" == true ]] || set_cursor_freecad_mcp_config
    invoke_mcp_smoke_test
    write_ok 'MCP smoke test passed'
  fi
  printf '\n\033[32m========== ALL STEPS PASSED ==========\033[0m\n'
}

main() {
  parse_args "$@"

  if [[ "$ACTION" == help ]]; then
    show_help
    exit 0
  fi

  printf '\n\033[35mfreecad-ai-bench [%s]\033[0m\n\n' "$ACTION"

  case "$ACTION" in
    setup) invoke_full_setup ;;
    freecad)
      if [[ "$FORCE_FREECAD" == true ]]; then
        bench_step 'Install FreeCAD' "${SCRIPT_DIR}/install-freecad.sh" --force
      else
        bench_step 'Install FreeCAD' "${SCRIPT_DIR}/install-freecad.sh"
      fi
      ;;
    fasteners)
      if [[ "$FORCE_FASTENERS" == true ]]; then
        bench_step 'Install Fasteners Workbench' "${SCRIPT_DIR}/install-fasteners.sh" --force
      else
        bench_step 'Install Fasteners Workbench' "${SCRIPT_DIR}/install-fasteners.sh"
      fi
      ;;
    init-fasteners) bench_step 'Initialize Fasteners Workbench' "${SCRIPT_DIR}/init-fasteners.sh" ;;
    mcp) invoke_mcp_setup ;;
    config)
      set_cursor_freecad_mcp_config
      write_ok 'Cursor MCP config complete'
      ;;
    verify)
      test_freecad_mcp_environment || exit 1
      [[ "$SKIP_CURSOR_CONFIG" == true ]] || set_cursor_freecad_mcp_config
      show_freecad_mcp_usage
      if [[ "$LAUNCH_FREECAD" == true ]]; then
        gui="$(find_freecad_gui || true)"
        [[ -n "$gui" ]] && "$gui" &
      fi
      write_ok 'Verification passed'
      ;;
    test-mcp)
      [[ "$SKIP_CURSOR_CONFIG" == true ]] || set_cursor_freecad_mcp_config
      [[ -d "$(freecad_mcp_addon_path)" ]] || die 'Addon missing. Run: ./freecad-mcp.sh mcp'
      invoke_mcp_smoke_test
      write_ok 'Smoke test passed'
      ;;
    test-model|screw) invoke_freecad_screw_via_mcp ;;
    *) die "Unknown action: $ACTION" ;;
  esac

  printf '\n\033[32mNext: FreeCAD -> Start RPC Server, then Cursor -> MCP: Reload Servers\033[0m\n'
}

main "$@"
