import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const d = 0.0015;
const HEX_R = 0.0025 / Math.sqrt(3);
const HEAD_TOP = 0.063;

function runCut(label, cutCall) {
  const vbs = join(dir, `cut-${label}.vbs`);
  writeFileSync(
    vbs,
    `Option Explicit
Dim swApp, swModel, ext, sm, fm, feat, cutFeat, status, j, ang, hx, hy, hx2, hy2, template
Const PI = 3.14159265358979
Const HEX_R = ${HEX_R}
Const HEX_DEPTH = ${d}
Const HEAD_TOP = ${HEAD_TOP}

Set swApp = GetObject(, "SldWorks.Application")
If swApp Is Nothing Then Set swApp = CreateObject("SldWorks.Application")
Set swModel = swApp.ActiveDoc
If swModel Is Nothing Then
  template = swApp.GetUserPreferenceStringValue(8)
  Set swModel = swApp.NewDocument(template, 0, 0, 0)
  Set ext = swModel.Extension: Set sm = swModel.SketchManager: Set fm = swModel.FeatureManager
  sm.InsertSketch True
  sm.CreateCircle 0, 0, 0, 0.00275, 0, 0
  sm.InsertSketch True
  swModel.ClearSelection2 True
  swModel.FeatureByPositionReverse(0).Select2 False, 0
  Set feat = fm.FeatureExtrusion3(True, False, False, 0, 0, HEAD_TOP, 0, False, False, False, False, 0, 0, False, False, False, False, True, True, True, 0, 0, False)
  swModel.EditRebuild3
Else
  Set ext = swModel.Extension: Set sm = swModel.SketchManager: Set fm = swModel.FeatureManager
End If

swModel.ClearSelection2 True
status = ext.SelectByRay(0, HEAD_TOP - 0.0001, 0, 0, 1, 0, 0.001, 2, False, 0, 0)
If Not status Then WScript.Echo "${label} ERR:face": WScript.Quit 1
sm.InsertSketch True
For j = 0 To 5
  ang = j * PI / 3
  hx = HEX_R * Cos(ang): hy = HEX_R * Sin(ang)
  ang = (j + 1) * PI / 3
  hx2 = HEX_R * Cos(ang): hy2 = HEX_R * Sin(ang)
  sm.CreateLine hx, hy, 0, hx2, hy2, 0
Next
sm.InsertSketch True
Set feat = swModel.FeatureByPositionReverse(0)
swModel.ClearSelection2 True
feat.Select2 False, 0

On Error Resume Next
Err.Clear
${cutCall}
If Err.Number <> 0 Then
  WScript.Echo "${label} ERR:" & Err.Number & " " & Err.Description
ElseIf cutFeat Is Nothing Then
  WScript.Echo "${label}:null"
Else
  WScript.Echo "${label}:OK:" & cutFeat.Name
End If
`,
    'utf-8',
  );
  const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 90000 });
  console.log((r.stdout || r.stderr || '').trim());
}

runCut(
  'Cut4-blind',
  `Set cutFeat = fm.FeatureCut4(True, False, False, 0, 0, HEX_DEPTH, 0, False, False, False, False, 0, 0, False, False, False, False, False, True, True, True, True, False, 0, 0, False, False)`,
);
runCut(
  'Cut4-through',
  `Set cutFeat = fm.FeatureCut4(True, False, False, 1, 0, HEX_DEPTH, 0, False, False, False, False, 1, 1, False, False, False, False, False, True, True, True, True, False, 0, 0, False, False)`,
);
