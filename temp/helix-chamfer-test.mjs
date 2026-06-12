import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });

function run(label, extraVbs) {
  const vbs = join(dir, `${label}.vbs`);
  writeFileSync(
    vbs,
    `Option Explicit
Dim swApp, swModel, ext, sm, fm, f, status, template
Set swApp = GetObject(, "SldWorks.Application")
template = swApp.GetUserPreferenceStringValue(8)
Set swModel = swApp.NewDocument(template, 0, 0, 0)
Set ext = swModel.Extension: Set sm = swModel.SketchManager: Set fm = swModel.FeatureManager
ext.SelectByID2 "Front Plane", "PLANE", 0, 0, 0, False, 0, Nothing, 0
sm.InsertSketch True: sm.CreateCircle 0, 0, 0, 0.0015, 0, 0: sm.InsertSketch True
swModel.FeatureByPositionReverse(0).Select2 False, 0
Set f = fm.FeatureExtrusion3(True, False, False, 0, 0, 0.06, 0, False, False, False, False, 0, 0, False, False, False, False, True, True, True, 0, 0, False)
ext.SelectByRay 0, 0, 0.059999, 0, 0, 1, 0.001, 2, False, 0, 0
sm.InsertSketch True: sm.CreateCircle 0, 0, 0, 0.00275, 0, 0: sm.InsertSketch True
swModel.FeatureByPositionReverse(0).Select2 False, 0
Set f = fm.FeatureExtrusion3(True, False, False, 0, 0, 0.003, 0, False, False, False, False, 0, 0, False, False, False, False, True, True, True, 0, 0, False)
swModel.EditRebuild3
${extraVbs}
`,
    'utf-8',
  );
  const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 120000 });
  console.log(`${label}:`, (r.stdout || r.stderr || '').trim().replace(/\r/g, '').split('\n').slice(0, 3).join(' | '));
}

// Helix approach: sketch circle on front plane at shank, insert helix feature
run(
  'helix',
  `
swModel.ClearSelection2 True
ext.SelectByID2 "Front Plane", "PLANE", 0, 0, 0, False, 0, Nothing, 0
sm.InsertSketch True
sm.CreateCircle 0, 0, 0, 0.0015, 0, 0
sm.InsertSketch True
Set f = swModel.FeatureByPositionReverse(0)
swModel.ClearSelection2 True
f.Select2 False, 0
On Error Resume Next
Err.Clear
Set f = fm.InsertHelix(False, True, False, False, 0.0005, 0.06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
If Err.Number <> 0 Then WScript.Echo "helix ERR:" & Err.Description
If f Is Nothing Then WScript.Echo "helix:null" Else WScript.Echo "helix:OK:" & f.Name
`,
);

// Chamfer via CreateDefinition swFmChamfer = 47? try numeric
run(
  'chamfer-def',
  `
swModel.ClearSelection2 True
status = ext.SelectByRay(0.00274, 0, 0.062999, 1, 0, 0, 0.001, 1, False, 0, 0)
WScript.Echo "edgeSel:" & status
Dim swDef, swCham
On Error Resume Next
Err.Clear
Set swDef = fm.CreateDefinition(47)
If swDef Is Nothing Then Set swDef = fm.CreateDefinition(7)
If swDef Is Nothing Then WScript.Echo "def:null": WScript.Quit 0
swDef.Initialize 0.0002, 0, 0, 0, 0, 0, 0, 0
swDef.AccessSelections swModel, Nothing
Set f = fm.CreateFeature(swDef)
If Err.Number <> 0 Then WScript.Echo "ch ERR:" & Err.Description
If f Is Nothing Then WScript.Echo "ch:null" Else WScript.Echo "ch:OK:" & f.Name
`,
);

// Thread via edge at shank bottom circle
run(
  'thread-edge',
  `
swModel.ClearSelection2 True
status = ext.SelectByRay(0.0015, 0, 0.0001, 0, 0, -1, 0.001, 1, False, 0, 0)
WScript.Echo "edgeSel:" & status
On Error Resume Next
Err.Clear
Set f = fm.InsertCosmeticThread2(0, 0.06, 0.0005, "M3x0.5", False, 0, 0, 0, 0, 0, 0)
If f Is Nothing Then
  Err.Clear
  Set f = ext.InsertCosmeticThread2(0, 0.06, 0.0005, "M3x0.5", False, 0, 0, 0, 0, 0, 0)
End If
If Err.Number <> 0 Then WScript.Echo "th ERR:" & Err.Description
If f Is Nothing Then WScript.Echo "th:null" Else WScript.Echo "th:OK:" & f.Name
`,
);
