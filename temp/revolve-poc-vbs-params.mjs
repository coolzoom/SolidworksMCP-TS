import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const R = 0.025;
const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const vbs = join(dir, 'revolve-params.vbs');

writeFileSync(
  vbs,
  `Option Explicit
Dim swApp, swModel, swFeat, swFM, swRev, angle, template, sketchName

Set swApp = CreateObject("SldWorks.Application")
swApp.Visible = True
template = swApp.GetUserPreferenceStringValue(8)
Set swModel = swApp.NewDocument(template, 0, 0, 0)
swModel.SketchManager.InsertSketch True
swModel.SketchManager.CreateCenterLine 0, -${R}, 0, 0, ${R}, 0
swModel.SketchManager.Create3PointArc -${R}, 0, 0, ${R}, 0, 0, 0, 0, 0
swModel.SketchManager.InsertSketch True
Set swFeat = swModel.FeatureByPositionReverse(0)
sketchName = swFeat.Name
angle = ${Math.PI * 2}
Set swFM = swModel.FeatureManager

Sub SelectAxis()
  swModel.ClearSelection2 True
  swFeat.Select2 False, 0
  swModel.Extension.SelectByID2 "Line1@" & sketchName, "EXTSKETCHSEGMENT", 0, 0, 0, True, 16, Nothing, 0
End Sub

On Error Resume Next
Call SelectAxis
Err.Clear
Set swRev = swFM.FeatureRevolve2(False, False, angle, 0, 0, 0, True, True, 0, 0)
If Err.Number <> 0 Then
  WScript.Echo "10 ERR:" & Err.Number & " " & Err.Description
ElseIf swRev Is Nothing Then
  WScript.Echo "10 null"
Else
  WScript.Echo "10 OK:" & swRev.Name
End If

Call SelectAxis
Err.Clear
Set swRev = swFM.FeatureRevolve(False, False, angle, 0, False, False, False, True)
If Err.Number <> 0 Then
  WScript.Echo "8 ERR:" & Err.Number & " " & Err.Description
ElseIf swRev Is Nothing Then
  WScript.Echo "8 null"
Else
  WScript.Echo "8 OK:" & swRev.Name
End If
`,
  'utf-8',
);

const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 120000 });
console.log(r.stdout?.trim());
console.log(r.stderr?.trim());
