import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const R = 0.025;
const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const vbs = join(dir, 'revolve-step.vbs');

writeFileSync(vbs, `
On Error Resume Next
Dim swApp, swModel, swFeat, swSketch, segs, seg, i, swFM, swRev, angle, template, errNum, errDesc

Sub Report(step)
  If Err.Number <> 0 Then
    WScript.Echo "FAIL@" & step & ": " & Err.Number & " " & Err.Description
    WScript.Quit Err.Number
  End If
End Sub

Set swApp = CreateObject("SldWorks.Application")
Report "CreateObject"
swApp.Visible = True
template = swApp.GetUserPreferenceStringValue(8)
Report "GetTemplate"
Set swModel = swApp.NewDocument(template, 0, 0, 0)
Report "NewDocument"

swModel.SketchManager.InsertSketch True
swModel.SketchManager.CreateCenterLine 0, -${R}, 0, 0, ${R}, 0
swModel.SketchManager.Create3PointArc -${R}, 0, 0, ${R}, 0, 0, 0, 0, 0
swModel.SketchManager.InsertSketch True
Report "Sketch"

angle = ${Math.PI * 2}
swModel.ClearSelection2 True
Set swFeat = swModel.FeatureByPositionReverse(0)
swFeat.Select2 False, 0
Report "SelectSketch"

Set swSketch = swFeat.GetSpecificFeature2
Report "GetSpecificFeature2"

segs = swSketch.GetSketchSegments
Report "GetSketchSegments"

WScript.Echo "SegCount:" & (UBound(segs) + 1)

For i = 0 To UBound(segs)
  Set seg = segs(i)
  If seg.ConstructionGeometry Then
    seg.Select4 True, Nothing
    Report "Select4"
    Exit For
  End If
Next

Set swFM = swModel.FeatureManager
Set swRev = swFM.FeatureRevolve2(False, False, angle, 0, 0, 0, True, True, 0, 0)
Report "FeatureRevolve2"
If swRev Is Nothing Then
  WScript.Echo "FAIL:revolve-null"
Else
  WScript.Echo "OK:" & swRev.Name
End If
`, 'utf-8');

const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 120000 });
console.log(r.stdout?.trim());
console.log(r.stderr?.trim());
