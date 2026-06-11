import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * M3 x 60mm hex socket head cap screw (ISO 4762).
 * Two-extrude body + hex cut (reliable on SW 2026).
 * Run: node scripts/draw-m3-screw.mjs
 */
const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const vbs = join(dir, 'm3-screw-60.vbs');

const SHANK_R = 0.003 / 2;
const SHANK_L = 0.06;
const HEAD_R = 0.0055 / 2;
const HEAD_K = 0.003;
const HEX_R = 0.0025 / Math.sqrt(3);
const HEX_DEPTH = 0.0015;
const TOTAL_Z = SHANK_L + HEAD_K;

writeFileSync(
  vbs,
  `Option Explicit
Dim swApp, swModel, ext, sm, fm, feat, shankFeat, headFeat, cutFeat, status, j, ang, hx, hy, hx2, hy2, template, errMsg

Const PI = 3.14159265358979
Const SHANK_R = ${SHANK_R}
Const SHANK_L = ${SHANK_L}
Const HEAD_R = ${HEAD_R}
Const HEAD_K = ${HEAD_K}
Const HEX_R = ${HEX_R}
Const HEX_DEPTH = ${HEX_DEPTH}
Const TOTAL_Z = ${TOTAL_Z}

On Error Resume Next
Set swApp = GetObject(, "SldWorks.Application")
If swApp Is Nothing Then Set swApp = CreateObject("SldWorks.Application")
swApp.Visible = True

template = swApp.GetUserPreferenceStringValue(8)
If template = "" Or InStr(template, "2023") > 0 Then
  template = "C:\\ProgramData\\SolidWorks\\SOLIDWORKS 2026\\templates\\Part.prtdot"
End If
Set swModel = swApp.NewDocument(template, 0, 0, 0)
If swModel Is Nothing Then WScript.Echo "ERR:NewDocument": WScript.Quit 1

Set ext = swModel.Extension
Set sm = swModel.SketchManager
Set fm = swModel.FeatureManager

' Shank: dia 3mm x 60mm
swModel.ClearSelection2 True
ext.SelectByID2 "Front Plane", "PLANE", 0, 0, 0, False, 0, Nothing, 0
sm.InsertSketch True
sm.CreateCircle 0, 0, 0, SHANK_R, 0, 0
sm.InsertSketch True
Set feat = swModel.FeatureByPositionReverse(0)
swModel.ClearSelection2 True
feat.Select2 False, 0
Set shankFeat = fm.FeatureExtrusion3(True, False, False, 0, 0, SHANK_L, 0, False, False, False, False, 0, 0, False, False, False, False, True, True, True, 0, 0, False)
If shankFeat Is Nothing Then WScript.Echo "ERR:shank": WScript.Quit 1
swModel.EditRebuild3

' Head: dia 5.5mm x 3mm on shank top
swModel.ClearSelection2 True
status = ext.SelectByRay(0, 0, SHANK_L - 0.0001, 0, 0, 1, 0.001, 2, False, 0, 0)
If Not status Then WScript.Echo "ERR:shank-top-face": WScript.Quit 1
sm.InsertSketch True
sm.CreateCircle 0, 0, 0, HEAD_R, 0, 0
sm.InsertSketch True
Set feat = swModel.FeatureByPositionReverse(0)
swModel.ClearSelection2 True
feat.Select2 False, 0
Set headFeat = fm.FeatureExtrusion3(True, False, False, 0, 0, HEAD_K, 0, False, False, False, False, 0, 0, False, False, False, False, True, True, True, 0, 0, False)
If headFeat Is Nothing Then WScript.Echo "ERR:head": WScript.Quit 1
swModel.EditRebuild3

' Hex socket on head top (AF=2.5mm, depth=1.5mm)
swModel.ClearSelection2 True
status = ext.SelectByRay(0, 0, TOTAL_Z - 0.0001, 0, 0, 1, 0.001, 2, False, 0, 0)
If Not status Then WScript.Echo "ERR:head-top-face": WScript.Quit 1
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
Err.Clear
Set cutFeat = fm.FeatureCut4(True, False, False, 0, 0, HEX_DEPTH, 0, False, False, False, False, 0, 0, False, False, False, False, False, True, True, True, True, False, 0, 0, False, False)
If Err.Number <> 0 Then errMsg = Err.Description
If cutFeat Is Nothing Then WScript.Echo "ERR:hex-cut " & errMsg: WScript.Quit 1

swModel.EditRebuild3
swModel.ViewZoomtofit2
WScript.Echo "OK:" & swModel.GetTitle & " shank=" & shankFeat.Name & " head=" & headFeat.Name & " hex=" & cutFeat.Name
`,
  'utf-8',
);

console.log('Drawing M3 x 60mm hex socket head cap screw (ISO 4762)...');
const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 120000 });
const out = (r.stdout || r.stderr || '').trim();
console.log(out);
process.exit(out.startsWith('OK:') ? 0 : 1);
