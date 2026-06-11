import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const HEX_R = 0.0025 / Math.sqrt(3);
const HEX_DEPTH = 0.0015;
const TOTAL_Y = 0.063;

function tryCut(label, cutLine) {
  const vbs = join(dir, `m3-cut-${label}.vbs`);
  writeFileSync(
    vbs,
    `Option Explicit
Dim swApp, swModel, ext, sm, fm, feat, bodyFeat, cutFeat, sketchName, swPlane, i, f, status, j, ang, hx, hy, hx2, hy2, template
Const PI = 3.14159265358979
Const SHANK_R = 0.0015
Const SHANK_L = 0.06
Const HEAD_R = 0.00275
Const TOTAL_Y = ${TOTAL_Y}
Const HEX_R = ${HEX_R}
Const HEX_DEPTH = ${HEX_DEPTH}

Set swApp = GetObject(, "SldWorks.Application")
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
swModel.EditRebuild3
swModel.ClearSelection2 True
status = ext.SelectByRay(0, TOTAL_Y - 0.0001, 0, 0, 1, 0, 0.001, 2, False, 0, 0)
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
swModel.ClearSelection2 True
ext.SelectByID2 sketchName, "SKETCH", 0, 0, 0, False, 0, Nothing, 0
On Error Resume Next
${cutLine}
If cutFeat Is Nothing Then WScript.Echo "${label}:null" Else WScript.Echo "${label}:OK:" & cutFeat.Name
`,
    'utf-8',
  );
  const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 90000 });
  console.log((r.stdout || '').trim());
}

const base =
  'Set cutFeat = fm.FeatureCut4(True, False, DIR, 0, 0, HEX_DEPTH, 0, False, False, False, False, 0, 0, False, False, False, False, False, True, True, TRUE, TRUE, False, 0, 0, False, False)';

for (const [label, dir] of [
  ['dir-false', 'False'],
  ['dir-true', 'True'],
  ['flip-true', 'False'].map(() => null),
]) {
  void label;
}

tryCut(
  'dir-false',
  'Set cutFeat = fm.FeatureCut4(True, False, False, 0, 0, HEX_DEPTH, 0, False, False, False, False, 0, 0, False, False, False, False, False, True, True, True, True, False, 0, 0, False, False)',
);
tryCut(
  'dir-true',
  'Set cutFeat = fm.FeatureCut4(True, False, True, 0, 0, HEX_DEPTH, 0, False, False, False, False, 0, 0, False, False, False, False, False, True, True, True, True, False, 0, 0, False, False)',
);
tryCut(
  'flip-true',
  'Set cutFeat = fm.FeatureCut4(True, True, False, 0, 0, HEX_DEPTH, 0, False, False, False, False, 0, 0, False, False, False, False, False, True, True, True, True, False, 0, 0, False, False)',
);
tryCut(
  'through-all',
  'Set cutFeat = fm.FeatureCut4(True, False, False, 1, 0, HEX_DEPTH, 0, False, False, False, False, 1, 1, False, False, False, False, False, True, True, True, True, False, 0, 0, False, False)',
);
