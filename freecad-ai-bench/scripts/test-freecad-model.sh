#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "${SCRIPT_DIR}/../lib/common.sh"

SIZE=M3
LENGTH=20
while [[ $# -gt 0 ]]; do
  case "$1" in
    --size|-Size) SIZE=$2; shift 2 ;;
    --length|-Length) LENGTH=$2; shift 2 ;;
    *) die "Unknown option: $1 (use --size M3 --length 20)" ;;
  esac
done

if [[ "$SIZE" =~ ^[0-9] ]]; then
  die "Invalid --size '$SIZE'. Use --size M3 --length 20"
fi
if ! [[ "$LENGTH" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  die "Invalid --length '$LENGTH'. Length must be a positive number in mm."
fi
if awk "BEGIN { exit !($LENGTH <= 0) }"; then
  die "Invalid --length '$LENGTH'. Length must be a positive number in mm."
fi

bench="$(bench_root)"
out_dir="${bench}/output"
mkdir -p "$out_dir"
fcstd="${out_dir}/${SIZE}x${LENGTH}_iso4762_threaded.FCStd"
step="${fcstd%.FCStd}.step"
py_script="${bench}/python/freecad-iso4762-screw.py"

freecad_cmd="$(find_freecadcmd || true)"
[[ -n "$freecad_cmd" ]] || die 'FreeCADCmd not found'
[[ -f "$py_script" ]] || die "Missing generator script: $py_script"
[[ -d "$(fasteners_mod_path)" ]] || die 'Fasteners Workbench not installed'

write_step "Generating ${SIZE}x${LENGTH} ISO4762 screw with real thread"
export SCREW_SIZE="$SIZE"
export SCREW_LENGTH="$LENGTH"
export SCREW_THREAD=real
export SCREW_OUTPUT="$fcstd"

"$freecad_cmd" "$py_script"
assert_last_exit $? 'FreeCAD model generation'

for file in "$fcstd" "$step"; do
  [[ -f "$file" ]] || die "Expected output missing: $file"
  bytes=$(wc -c <"$file" | tr -d ' ')
  [[ "$bytes" -ge 512 ]] || die "Output too small ($bytes bytes): $file"
  write_ok "$file ($bytes bytes)"
done
write_ok 'FreeCAD model generation test passed'
