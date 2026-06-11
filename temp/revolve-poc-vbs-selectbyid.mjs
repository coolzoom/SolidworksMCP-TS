import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const R = 0.025;
const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const vbs = join(dir, 'revolve-selectbyid.vbs');

writeFileSync(vbs, `
Option Explicit
Dim swApp, swModel, swFeat, swFM, swRev, angle, template, sketchName, ok

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
WScript.Echo "Sketch:" & sketchName

angle = ${Math.PI * 2}
swModel.ClearSelection2 True
swFeat.Select2 False, 0

ok = swModel.Extension.SelectByID2("Line1@" & sketchName, "SKETCHSEGMENT", 0, 0, 0, True, 16, Nothing, 0)
WScript.Echo "SelectByID2 SKETCHSEGMENT => " & ok

If Not ok Then
  ok = swModel.Extension.SelectByID2("Line1@" & sketchName, "EXTSKETCHSEGMENT", 0, 0, 0, True, 16, Nothing, 0)
  WScript.Echo "SelectByID2 EXTSKETCHSEGMENT => " & ok
End If

Set swFM = swModel.FeatureManager
Set swRev = swFM.FeatureRevolve2(False, False, angle, 0, 0, 0, True, True, 0, 0)
If swRev Is Nothing Then
  WScript.Echo "FeatureRevolve2 => null"
Else
  WScript.Echo "OK:" & swRev.Name
End If
`, 'utf-8');

const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 120000 });
console.log(r.stdout?.trim());
console.log(r.stderr?.trim());
