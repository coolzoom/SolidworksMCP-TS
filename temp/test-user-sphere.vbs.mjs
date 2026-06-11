import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const radius = 0.025;
const angle = Math.PI * 2;
const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const vbs = join(dir, 'user-sphere.vbs');

writeFileSync(
  vbs,
  `Option Explicit
Dim swApp, swModel, swModelDocExt, swSketchMgr, swFeatureMgr, swFeat, swRev, swPlane
Dim status, radius, angle, sketchName, i, feat

radius = ${radius}
angle = ${angle}
On Error Resume Next

Set swApp = CreateObject("SldWorks.Application")
swApp.Visible = True
Set swModel = swApp.NewDocument(swApp.GetUserPreferenceStringValue(8), 0, 0, 0)
If swModel Is Nothing Then WScript.Echo "ERR:no-part": WScript.Quit 1

Set swModelDocExt = swModel.Extension
Set swSketchMgr = swModel.SketchManager
Set swFeatureMgr = swModel.FeatureManager

' Select Front plane via feature tree (avoids localized SelectByID2 names)
Set swPlane = Nothing
For i = 0 To swModel.GetFeatureCount() - 1
  Set feat = swModel.FeatureByPositionReverse(i)
  If feat.GetTypeName2 = "RefPlane" Then
    If InStr(1, feat.Name, "Front", vbTextCompare) > 0 Or InStr(1, feat.Name, ChrW(21069), vbTextCompare) > 0 Then
      Set swPlane = feat
      Exit For
    End If
  End If
Next
If swPlane Is Nothing Then
  For i = 0 To swModel.GetFeatureCount() - 1
    Set feat = swModel.FeatureByPositionReverse(i)
    If feat.GetTypeName2 = "RefPlane" Then Set swPlane = feat: Exit For
  Next
End If
If swPlane Is Nothing Then WScript.Echo "ERR:no-plane": WScript.Quit 1
swPlane.Select2 False, 0

swSketchMgr.InsertSketch True
swSketchMgr.CreateCenterLine 0, -radius, 0, 0, radius, 0
swSketchMgr.Create3PointArcCenter 0, 0, 0, 0, radius, 0, 0, -radius, 0
swSketchMgr.InsertSketch True

Set swFeat = swModel.FeatureByPositionReverse(0)
sketchName = swFeat.Name
WScript.Echo "Sketch:" & sketchName

swModel.ClearSelection2 True
status = swModelDocExt.SelectByID2(sketchName, "SKETCH", 0, 0, 0, False, 0, Nothing, 0)
WScript.Echo "SketchSelect:" & status

' User method: EXTSKETCHSEGMENT + pick on centerline, mark=1
status = swModelDocExt.SelectByID2("Line1@" & sketchName, "EXTSKETCHSEGMENT", 0, radius / 2, 0, True, 1, Nothing, 0)
WScript.Echo "AxisMark1:" & status

Err.Clear
Set swRev = swFeatureMgr.FeatureRevolve2(True, True, False, False, False, False, 0, 0, angle, 0, False, False, 0, 0, 0, 0, 0, True, False, True)
If Err.Number <> 0 Then WScript.Echo "ERR:" & Err.Description: WScript.Quit 1
If swRev Is Nothing Then WScript.Echo "ERR:null": WScript.Quit 1
swModel.EditRebuild3
WScript.Echo "OK:" & swRev.Name
`,
  'utf-8',
);

const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 120000 });
console.log(r.stdout?.trim());
if (r.stderr?.trim()) console.log('stderr:', r.stderr.trim());
