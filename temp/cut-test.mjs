import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const d = 0.0015;
const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });

const tries = [
  ['Cut3', `Set cutFeat = fm.FeatureCut3(True, False, False, 0, 0, ${d}, 0, False, False, False, False, 0, 0, False, False, False, False, True, True, True, 0, 0, False)`],
  ['Cut4', `Set cutFeat = fm.FeatureCut4(True, False, False, 0, 0, ${d}, 0, False, False, False, False, 0, 0, False, False, False, False, True, True, True, 0, 0, False)`],
  ['ExtrudeThinCut', `Set cutFeat = fm.InsertCutExtrude2(True, False, False, 0, 0, ${d}, 0)`],
];

for (const [name, call] of tries) {
  if (typeof fm !== 'undefined') {}
  const vbs = join(dir, `cut-${name}.vbs`);
  writeFileSync(
    vbs,
    `Option Explicit
Dim swApp, swModel, fm, feat, cutFeat
Set swApp = CreateObject("SldWorks.Application")
Set swModel = swApp.ActiveDoc
If swModel Is Nothing Then WScript.Echo "no-doc": WScript.Quit 0
Set fm = swModel.FeatureManager
Set feat = swModel.FeatureByPositionReverse(0)
swModel.ClearSelection2 True
feat.Select2 False, 0
On Error Resume Next
${call}
If Err.Number <> 0 Then
  WScript.Echo "${name} ERR:" & Err.Number & " " & Err.Description
ElseIf cutFeat Is Nothing Then
  WScript.Echo "${name}:null"
Else
  WScript.Echo "${name}:OK:" & cutFeat.Name
End If
`,
    'utf-8',
  );
  const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 60000 });
  console.log((r.stdout || '').trim());
}
