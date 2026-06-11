import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });

const HEX_R = 0.0025 / Math.sqrt(3);

function run(label, body) {
  const vbs = join(dir, `${label}.vbs`);
  writeFileSync(vbs, body, 'utf-8');
  const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 120000 });
  console.log(`${label}:`, (r.stdout || r.stderr || '').trim());
}

run(
  'screw-extras',
  `Option Explicit
Dim swApp, swModel, ext, sm, fm, feat, status, j, ang, hx, hy, hx2, hy2, template
Dim shankFeat, headFeat, cutFeat, chamferFeat, threadFeat, errMsg
Dim SHANK_R, SHANK_L, HEAD_R, HEAD_K, HEX_R, HEX_DEPTH, TOTAL_Z, PITCH, CHAMFER

SHANK_R = 0.0015
SHANK_L = 0.06
HEAD_R = 0.00275
HEAD_K = 0.003
HEX_R = ${HEX_R}
HEX_DEPTH = 0.0015
TOTAL_Z = 0.063
PITCH = 0.0005
CHAMFER = 0.0002

Set swApp = GetObject(, "SldWorks.Application")
If swApp Is Nothing Then Set swApp = CreateObject("SldWorks.Application")
template = swApp.GetUserPreferenceStringValue(8)
Set swModel = swApp.NewDocument(template, 0, 0, 0)
Set ext = swModel.Extension
Set sm = swModel.SketchManager
Set fm = swModel.FeatureManager

ext.SelectByID2 "Front Plane", "PLANE", 0, 0, 0, False, 0, Nothing, 0
sm.InsertSketch True
sm.CreateCircle 0, 0, 0, SHANK_R, 0, 0
sm.InsertSketch True
swModel.FeatureByPositionReverse(0).Select2 False, 0
Set shankFeat = fm.FeatureExtrusion3(True, False, False, 0, 0, SHANK_L, 0, False, False, False, False, 0, 0, False, False, False, False, True, True, True, 0, 0, False)
swModel.EditRebuild3

status = ext.SelectByRay(0, 0, SHANK_L - 0.0001, 0, 0, 1, 0.001, 2, False, 0, 0)
sm.InsertSketch True
sm.CreateCircle 0, 0, 0, HEAD_R, 0, 0
sm.InsertSketch True
swModel.FeatureByPositionReverse(0).Select2 False, 0
Set headFeat = fm.FeatureExtrusion3(True, False, False, 0, 0, HEAD_K, 0, False, False, False, False, 0, 0, False, False, False, False, True, True, True, 0, 0, False)
swModel.EditRebuild3

status = ext.SelectByRay(0, 0, TOTAL_Z - 0.0001, 0, 0, 1, 0.001, 2, False, 0, 0)
sm.InsertSketch True
For j = 0 To 5
  ang = j * 3.14159265358979 / 3
  hx = HEX_R * Cos(ang)
  hy = HEX_R * Sin(ang)
  ang = (j + 1) * 3.14159265358979 / 3
  hx2 = HEX_R * Cos(ang)
  hy2 = HEX_R * Sin(ang)
  sm.CreateLine hx, hy, 0, hx2, hy2, 0
Next
sm.InsertSketch True
swModel.FeatureByPositionReverse(0).Select2 False, 0
Set cutFeat = fm.FeatureCut4(True, False, False, 0, 0, HEX_DEPTH, 0, False, False, False, False, 0, 0, False, False, False, False, False, True, True, True, True, False, 0, 0, False, False)
swModel.EditRebuild3

' Head top outer edge chamfer
swModel.ClearSelection2 True
status = ext.SelectByRay(HEAD_R - 0.00005, 0, TOTAL_Z - 0.00005, 1, 0, 0, 0.001, 1, False, 0, 0)
If Not status Then status = ext.SelectByRay(HEAD_R * 0.99, 0, TOTAL_Z, 0, 0, -1, 0.001, 1, False, 0, 0)
WScript.Echo "chamfer-edge:" & status
Err.Clear
Set chamferFeat = fm.InsertChamfer(4, CHAMFER, 0, 0, 0, 0, 0, 0)
If chamferFeat Is Nothing Then Set chamferFeat = fm.FeatureChamfer(4, CHAMFER, 0, 0, 0, 0, 0, 0)
If Err.Number <> 0 Then WScript.Echo "chamfer ERR:" & Err.Description
If chamferFeat Is Nothing Then WScript.Echo "chamfer:null" Else WScript.Echo "chamfer:OK:" & chamferFeat.Name

' Cosmetic thread - select shank cylindrical face
swModel.ClearSelection2 True
status = ext.SelectByRay(SHANK_R - 0.00005, 0, SHANK_L * 0.5, 1, 0, 0, 0.001, 2, False, 0, 0)
WScript.Echo "thread-face:" & status
Err.Clear
Set threadFeat = fm.InsertCosmeticThread2(1, SHANK_L, PITCH, "M3x0.5", True, 0, 0, 0, 0, 0, 0)
If threadFeat Is Nothing Then
  Err.Clear
  Set threadFeat = fm.InsertCosmeticThread(1, SHANK_L, PITCH, "M3x0.5", True)
End If
If Err.Number <> 0 Then WScript.Echo "thread ERR:" & Err.Description
If threadFeat Is Nothing Then WScript.Echo "thread:null" Else WScript.Echo "thread:OK:" & threadFeat.Name
`,
);
