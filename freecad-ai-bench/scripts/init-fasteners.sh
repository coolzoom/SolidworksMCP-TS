#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "${SCRIPT_DIR}/../lib/common.sh"

write_step 'Initializing Fasteners Workbench (import + ISO4762 table check)'

freecad_cmd="$(find_freecadcmd || true)"
[[ -n "$freecad_cmd" ]] || die 'FreeCADCmd not found. Run: ./freecad-mcp.sh freecad'

target="$(fasteners_mod_path)"
[[ -d "$target" ]] || die 'Fasteners Workbench not installed. Run: ./freecad-mcp.sh fasteners'

init_script=$'import FreeCAD as App\nimport ScrewMaker\nimport FastenersCmd\nsm = ScrewMaker.Instance\nlengths = sm.GetAllLengths(\'ISO4762\', \'M3\', True)\nif \'20\' not in lengths:\n    raise RuntimeError(\'ISO4762 M3 lengths missing expected value 20: \' + str(lengths))\nApp.Console.PrintMessage(\'Fasteners init OK. ISO4762 M3 lengths: \' + str(lengths) + \'\\n\')\n'

"$freecad_cmd" -c "$init_script"
assert_last_exit $? 'Fasteners initialization'
write_ok 'Fasteners Workbench initialized successfully'
