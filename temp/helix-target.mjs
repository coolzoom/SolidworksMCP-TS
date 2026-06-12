import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });

for (const target of ['fm', 'swModel', 'ext']) {
  const vbs = join(dir, `helix-${target}.vbs`);
  writeFileSync(
    vbs,
    `Option Explicit
Dim swApp, swModel, ext, sm, fm, f
Set swApp = GetObject(, "SldWorks.Application")
Set swModel = swApp.NewDocument(swApp.GetUserPreferenceStringValue(8), 0, 0, 0)
Set ext = swModel.Extension: Set sm = swModel.SketchManager: Set fm = swModel.FeatureManager
ext.SelectByID2 "Front Plane", "PLANE", 0, 0, 0, False, 0, Nothing, 0
sm.InsertSketch True: sm.CreateCircle 0, 0, 0, 0.0015, 0, 0: sm.InsertSketch True
swModel.FeatureByPositionReverse(0).Select2 False, 0
On Error Resume Next: Err.Clear
Select Case "${target}"
  Case "fm": Set f = fm.InsertHelix(False, True, True, False, 0.0005, 0.06, 0)
  Case "swModel": Set f = swModel.InsertHelix(False, True, True, False, 0.0005, 0.06, 0)
  Case "ext": Set f = ext.InsertHelix(False, True, True, False, 0.0005, 0.06, 0)
End Select
If Err.Number <> 0 Then WScript.Echo "${target} ERR:" & Err.Number & " " & Err.Description ElseIf f Is Nothing Then WScript.Echo "${target}:null" Else WScript.Echo "${target}:OK:" & f.Name
`,
    'utf-8',
  );
  const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 90000 });
  console.log((r.stdout || '').trim());
}
