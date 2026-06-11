import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const vbs = join(dir, 'm3-screw-debug.vbs');

const SHANK_R = 0.003 / 2;
const SHANK_L = 0.06;
const HEAD_R = 0.0055 / 2;
const HEAD_K = 0.003;
const HEX_R = 0.0025 / Math.sqrt(3);
const HEX_DEPTH = 0.0015;
const TOTAL_Y = SHANK_L + HEAD_K;

writeFileSync(
  vbs,
  `Option Explicit
Dim swApp, swModel, ext, sm, fm, feat, bodyFeat, cutFeat, sketchName, swPlane, i, f, status, j, ang, hx, hy, hx2, hy2, template
Const PI = 3.14159265358979
Const SHANK_R = ${SHANK_R}
Const SHANK_L = ${SHANK_L}
Const HEAD_R = ${HEAD_R}
Const HEAD_K = ${HEAD_K}
Const HEX_R = ${HEX_R}
Const HEX_DEPTH = ${HEX_DEPTH}
Const TOTAL_Y = ${TOTAL_Y}

Set swApp = GetObject(, "SldWorks.Application")
If swApp Is Nothing Then Set swApp = CreateObject("SldWorks.Application")
template = swApp.GetUserPreferenceStringValue(8)
Set swModel = swApp.NewDocument(template, 0, 0, 0)
Set ext = swModel.Extension: Set sm = swModel.SketchManager: Set fm = swModel.FeatureManager

For i = 0 To swModel.GetFeatureCount() - 1
  Set f = swModel.FeatureByPositionReverse(i)
  If f.GetTypeName2 = "RefPlane" Then Set swPlane = f: Exit For
Next
swPlane.Select2 False, 0
sm.InsertSketch True
sm.CreateCenterLine 0, -0.005, 0, 0, TOTAL_Y + 0.005, 0
sm.CreateLine 0, 0, 0, SHANK_R, 0, 0
sm.CreateLine SHANK_R, 0, 0, SHANK_R, SHANK_L, 0
sm.CreateLine SHANK_R, SHANK_L, 0, HEAD_R, SHANK_L, 0
sm.CreateLine HEAD_R, SHANK_L, 0, HEAD_R, TOTAL_Y, 0
sm.CreateLine HEAD_R, TOTAL_Y, 0, 0, TOTAL_Y, 0
sm.CreateLine 0, TOTAL_Y, 0, 0, 0, 0
sm.InsertSketch True
Set feat = swModel.FeatureByPositionReverse(0)
sketchName = feat.Name
swModel.ClearSelection2 True
ext.SelectByID2 sketchName, "SKETCH", 0, 0, 0, False, 0, Nothing, 0
ext.SelectByID2 "Line1@" & sketchName, "EXTSKETCHSEGMENT", 0, SHANK_L / 2, 0, True, 1, Nothing, 0
Set bodyFeat = fm.FeatureRevolve2(True, True, False, False, False, False, 0, 0, 6.283185307, 0, False, False, 0, 0, 0, 0, 0, True, False, True)
If bodyFeat Is Nothing Then WScript.Echo "FAIL:revolve": WScript.Quit 1
swModel.EditRebuild3
WScript.Echo "STEP:revolve OK"

swModel.ClearSelection2 True
status = ext.SelectByRay(0, TOTAL_Y - 0.0001, 0, 0, 1, 0, 0.001, 2, False, 0, 0)
If Not status Then status = ext.SelectByRay(HEAD_R * 0.4, TOTAL_Y - 0.0001, 0, 0, 1, 0, 0.001, 2, False, 0, 0)
If Not status Then status = ext.SelectByRay(0, TOTAL_Y - 0.0001, 0, 0, -1, 0, 0.001, 2, False, 0, 0)
If Not status Then WScript.Echo "FAIL:face-pick": WScript.Quit 1
WScript.Echo "STEP:face OK"

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
sketchName = feat.Name
WScript.Echo "STEP:hex-sketch " & sketchName
swModel.ClearSelection2 True
feat.Select2 False, 0
Set cutFeat = fm.FeatureCut4(True, False, False, 0, 0, HEX_DEPTH, 0, False, False, False, False, 0, 0, False, False, False, False, False, True, True, True, True, False, 0, 0, False, False)
If cutFeat Is Nothing Then WScript.Echo "FAIL:cut null": WScript.Quit 1
WScript.Echo "OK:" & cutFeat.Name
`,
  'utf-8',
);

const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 120000 });
console.log((r.stdout || r.stderr || '').trim());
