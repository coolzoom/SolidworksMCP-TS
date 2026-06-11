import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const R = 0.025;
const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const vbs = join(dir, 'revolve-final.vbs');

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
angle = ${Math.PI * 2}

swModel.ClearSelection2 True
swFeat.Select2 False, 0
ok = swModel.Extension.SelectByID2("Line1@" & sketchName, "EXTSKETCHSEGMENT", 0, 0, 0, True, 16, Nothing, 0)
WScript.Echo "Axis selected:" & ok

Set swFM = swModel.FeatureManager
Set swRev = swFM.FeatureRevolve(False, False, angle, 0, False, False, False, True)
If Not swRev Is Nothing Then
  WScript.Echo "OK8:" & swRev.Name
  WScript.Quit 0
End If
WScript.Echo "Rev8 null"

Set swRev = swFM.FeatureRevolve2(True, False, False, False, False, angle, 0, 0, 0, 0, 0, True)
If Not swRev Is Nothing Then
  WScript.Echo "OK12a:" & swRev.Name
  WScript.Quit 0
End If
WScript.Echo "Rev12a null"

Set swRev = swFM.FeatureRevolve2(False, False, False, False, False, angle, 0, 0, 0, 0, 0, True)
If Not swRev Is Nothing Then
  WScript.Echo "OK12b:" & swRev.Name
  WScript.Quit 0
End If
WScript.Echo "FAIL all null"
`, 'utf-8');

const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 120000 });
console.log(r.stdout?.trim());
console.log(r.stderr?.trim());
