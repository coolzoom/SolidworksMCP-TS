import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const vbs = join(tmpdir(), 'solidworks-mcp-macros', 'revolve-cut-test.vbs');
writeFileSync(
  vbs,
  `Option Explicit
Dim swApp, swModel, ext, sm, fm, feat, cutFeat, swPlane, i, f, status, template
Const TOTAL_Y = 0.063
Const SHANK_R = 0.0015
Const SHANK_L = 0.06
Const HEAD_R = 0.00275
Const DEPTH = 0.0015

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
swModel.ClearSelection2 True
ext.SelectByID2 feat.Name, "SKETCH", 0, 0, 0, False, 0, Nothing, 0
ext.SelectByID2 "Line1@" & feat.Name, "EXTSKETCHSEGMENT", 0, SHANK_L / 2, 0, True, 1, Nothing, 0
Set feat = fm.FeatureRevolve2(True, True, False, False, False, False, 0, 0, 6.283185307, 0, False, False, 0, 0, 0, 0, 0, True, False, True)
swModel.EditRebuild3

' Test A: circle cut on top face
swModel.ClearSelection2 True
status = ext.SelectByRay(0, TOTAL_Y - 0.0001, 0, 0, 1, 0, 0.001, 2, False, 0, 0)
WScript.Echo "face:" & status
sm.InsertSketch True
sm.CreateCircle 0, 0, 0, 0.001, 0, 0
sm.InsertSketch True
Set feat = swModel.FeatureByPositionReverse(0)
swModel.ClearSelection2 True
feat.Select2 False, 0
Set cutFeat = fm.FeatureCut4(True, False, False, 0, 0, DEPTH, 0, False, False, False, False, 0, 0, False, False, False, False, False, True, True, True, True, False, 0, 0, False, False)
If cutFeat Is Nothing Then WScript.Echo "circle-cut:null" Else WScript.Echo "circle-cut:OK:" & cutFeat.Name
`,
  'utf-8',
);

const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 90000 });
console.log((r.stdout || '').trim());
