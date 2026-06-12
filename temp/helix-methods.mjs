import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });

const methods = ['InsertHelix', 'InsertHelix2', 'InsertHelix3', 'InsertHelix4', 'FeatureHelix', 'InsertCurveHelix', 'InsertReferenceCurveHelix'];

for (const m of methods) {
  const vbs = join(dir, `hm-${m}.vbs`);
  writeFileSync(
    vbs,
    `Option Explicit
Dim swApp, swModel, fm, sm, ext, f
Set swApp = GetObject(, "SldWorks.Application")
Set swModel = swApp.NewDocument(swApp.GetUserPreferenceStringValue(8), 0, 0, 0)
Set fm = swModel.FeatureManager: Set sm = swModel.SketchManager: Set ext = swModel.Extension
ext.SelectByID2 "Front Plane", "PLANE", 0, 0, 0, False, 0, Nothing, 0
sm.InsertSketch True: sm.CreateCircle 0, 0, 0, 0.0015, 0, 0: sm.InsertSketch True
swModel.FeatureByPositionReverse(0).Select2 False, 0
On Error Resume Next
Set f = fm.${m}
If Err.Number <> 0 Then
  WScript.Echo "${m}:no-method"
Else
  WScript.Echo "${m}:exists type=" & TypeName(f)
End If
`,
    'utf-8',
  );
  const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 60000 });
  console.log((r.stdout || '').trim());
}
