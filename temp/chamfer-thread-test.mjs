import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const CHAMFER = 0.0002;
const TOTAL_Z = 0.063;
const HEAD_R = 0.00275;

function buildBase() {
  return `
Set swApp = GetObject(, "SldWorks.Application")
Set swModel = swApp.NewDocument(swApp.GetUserPreferenceStringValue(8), 0, 0, 0)
Set ext = swModel.Extension: Set sm = swModel.SketchManager: Set fm = swModel.FeatureManager
ext.SelectByID2 "Front Plane", "PLANE", 0, 0, 0, False, 0, Nothing, 0
sm.InsertSketch True: sm.CreateCircle 0, 0, 0, 0.0015, 0, 0: sm.InsertSketch True
swModel.FeatureByPositionReverse(0).Select2 False, 0
fm.FeatureExtrusion3 True, False, False, 0, 0, 0.06, 0, False, False, False, False, 0, 0, False, False, False, False, True, True, True, 0, 0, False
ext.SelectByRay 0, 0, 0.059999, 0, 0, 1, 0.001, 2, False, 0, 0
sm.InsertSketch True: sm.CreateCircle 0, 0, 0, ${HEAD_R}, 0, 0: sm.InsertSketch True
swModel.FeatureByPositionReverse(0).Select2 False, 0
fm.FeatureExtrusion3 True, False, False, 0, 0, 0.003, 0, False, False, False, False, 0, 0, False, False, False, False, True, True, True, 0, 0, False
swModel.EditRebuild3
swModel.ClearSelection2 True
ext.SelectByRay ${HEAD_R - 0.00005}, 0, ${TOTAL_Z - 0.00005}, 1, 0, 0, 0.001, 1, False, 0, 0
`;
}

const chamferTries = [
  ['FeatureChamfer-4arg', `Set f = fm.FeatureChamfer(4, ${CHAMFER}, 0, 0)`],
  ['FeatureChamfer-8arg', `Set f = fm.FeatureChamfer(4, ${CHAMFER}, 0, 0, 0, 0, 0, 0)`],
  ['FeatureChamfer2', `Set f = fm.FeatureChamfer2(4, ${CHAMFER}, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)`],
  ['InsertFeatureChamfer', `Set f = fm.InsertFeatureChamfer(4, ${CHAMFER}, 0, 0, 0, 0, 0, 0)`],
];

for (const [label, call] of chamferTries) {
  const vbs = join(dir, `ch-${label}.vbs`);
  writeFileSync(
    vbs,
    `Option Explicit
Dim swApp, swModel, ext, sm, fm, f
${buildBase()}
On Error Resume Next
Err.Clear
${call}
If Err.Number <> 0 Then WScript.Echo "${label} ERR:" & Err.Description ElseIf f Is Nothing Then WScript.Echo "${label}:null" Else WScript.Echo "${label}:OK:" & f.Name
`,
    'utf-8',
  );
  const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 90000 });
  console.log((r.stdout || r.stderr || '').trim().split('\n')[0]);
}

// Thread tries on shank face
const threadTries = [
  ['CosmeticThread2', `Set f = fm.InsertCosmeticThread2(1, 0.06, 0.0005, "M3x0.5", True, 0, 0, 0, 0, 0, 0)`],
  ['CosmeticThread', `Set f = fm.InsertCosmeticThread(1, 0.06, 0.0005, "M3x0.5", True)`],
  ['CosmeticThread3', `Set f = fm.InsertCosmeticThread3(1, 0.06, 0.0005, "M3x0.5", True, 0, 0, 0, 0)`],
  ['CosmeticThread5', `Set f = fm.InsertCosmeticThread5(1, 0.06, 0.0005, "M3x0.5", True, 0, 0, 0, 0, 0, 0, 0, 0)`],
];

for (const [label, call] of threadTries) {
  const vbs = join(dir, `th-${label}.vbs`);
  writeFileSync(
    vbs,
    `Option Explicit
Dim swApp, swModel, ext, sm, fm, f, status
Set swApp = GetObject(, "SldWorks.Application")
Set swModel = swApp.ActiveDoc
If swModel Is Nothing Then
  Set swModel = swApp.NewDocument(swApp.GetUserPreferenceStringValue(8), 0, 0, 0)
  Set ext = swModel.Extension: Set sm = swModel.SketchManager: Set fm = swModel.FeatureManager
  ext.SelectByID2 "Front Plane", "PLANE", 0, 0, 0, False, 0, Nothing, 0
  sm.InsertSketch True: sm.CreateCircle 0, 0, 0, 0.0015, 0, 0: sm.InsertSketch True
  swModel.FeatureByPositionReverse(0).Select2 False, 0
  fm.FeatureExtrusion3 True, False, False, 0, 0, 0.06, 0, False, False, False, False, 0, 0, False, False, False, False, True, True, True, 0, 0, False
  swModel.EditRebuild3
Else
  Set ext = swModel.Extension: Set fm = swModel.FeatureManager
End If
swModel.ClearSelection2 True
status = ext.SelectByRay(0.00145, 0, 0.03, 1, 0, 0, 0.001, 2, False, 0, 0)
On Error Resume Next
Err.Clear
${call}
If Err.Number <> 0 Then WScript.Echo "${label} ERR:" & Err.Description ElseIf f Is Nothing Then WScript.Echo "${label}:null face=" & status Else WScript.Echo "${label}:OK:" & f.Name
`,
    'utf-8',
  );
  const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 90000 });
  console.log((r.stdout || r.stderr || '').trim().split('\n')[0]);
}
