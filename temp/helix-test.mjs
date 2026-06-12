import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });

const tries = [
  ['Helix-simple', 'Set f = fm.InsertHelix(False, True, True, False, 0.0005, 0.06, 0)'],
  ['Helix2', 'Set f = fm.InsertHelix2(False, True, True, False, 0.0005, 0.06, 0, 0, 0)'],
  ['Helix3', 'Set f = fm.InsertHelix3(False, True, True, False, 0.0005, 0.06, 0, 0, 0, 0, 0)'],
  ['CurveHelix', 'Set f = fm.InsertCurveHelix(False, True, True, False, 0.0005, 0.06, 0)'],
];

for (const [label, call] of tries) {
  const vbs = join(dir, `${label}.vbs`);
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
${call}
If Err.Number <> 0 Then WScript.Echo "${label} ERR:" & Err.Description ElseIf f Is Nothing Then WScript.Echo "${label}:null" Else WScript.Echo "${label}:OK:" & f.Name
`,
    'utf-8',
  );
  const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 90000 });
  console.log((r.stdout || '').trim());
}
