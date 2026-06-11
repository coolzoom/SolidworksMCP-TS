import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const R = 0.025;
const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const vbs = join(dir, 'revolve-select2.vbs');

writeFileSync(vbs, `
Option Explicit
Dim swApp, swModel, swFeat, swSketch, segs, seg, i, swFM, swRev, angle, template, sel

Set swApp = CreateObject("SldWorks.Application")
swApp.Visible = True
template = swApp.GetUserPreferenceStringValue(8)
Set swModel = swApp.NewDocument(template, 0, 0, 0)

swModel.SketchManager.InsertSketch True
swModel.SketchManager.CreateCenterLine 0, -${R}, 0, 0, ${R}, 0
swModel.SketchManager.Create3PointArc -${R}, 0, 0, ${R}, 0, 0, 0, 0, 0
swModel.SketchManager.InsertSketch True

angle = ${Math.PI * 2}
swModel.ClearSelection2 True
Set swFeat = swModel.FeatureByPositionReverse(0)
swFeat.Select2 False, 0

Set swSketch = swFeat.GetSpecificFeature2
segs = swSketch.GetSketchSegments

For i = 0 To UBound(segs)
  Set seg = segs(i)
  If seg.ConstructionGeometry Then
    sel = seg.Select2(True, 16)
    WScript.Echo "Select2(16) => " & sel
    Exit For
  End If
Next

Set swFM = swModel.FeatureManager

' Try multiple FeatureRevolve2 signatures
On Error Resume Next
Set swRev = swFM.FeatureRevolve2(False, False, angle, 0, 0, 0, True, True, 0, 0)
If Err.Number = 0 And Not swRev Is Nothing Then
  WScript.Echo "OK10:" & swRev.Name
  WScript.Quit 0
End If
WScript.Echo "Rev10 err:" & Err.Number & " " & Err.Description
Err.Clear

Set swRev = swFM.FeatureRevolve(False, False, angle, 0, False, False, False, True)
If Err.Number = 0 And Not swRev Is Nothing Then
  WScript.Echo "OK8:" & swRev.Name
  WScript.Quit 0
End If
WScript.Echo "Rev8 err:" & Err.Number & " " & Err.Description & " null=" & (swRev Is Nothing)
`, 'utf-8');

const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 120000 });
console.log(r.stdout?.trim());
console.log(r.stderr?.trim());
