import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadWinax } from '../dist/adapters/winax-loader.js';
import { SolidWorksConfig } from '../dist/utils/solidworks-config.js';

const R = 0.025;
const winax = loadWinax();
const swApp = new winax.Object('SldWorks.Application');
const model = swApp.NewDocument(SolidWorksConfig.getTemplatePath(swApp, 'part'), 0, 0, 0);
model.SketchManager.InsertSketch(true);
model.SketchManager.CreateCenterLine(0, -R, 0, 0, R, 0);
model.SketchManager.Create3PointArc(-R, 0, 0, R, 0, 0, 0, 0, 0);
model.SketchManager.InsertSketch(true);
const title = model.GetTitle();
console.log('Winax doc:', title);

const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const vbs = join(dir, 'revolve-bridge-debug.vbs');
writeFileSync(
  vbs,
  `Option Explicit
Dim swApp, swModel, swFeat, swFM, swRev, sketchName, ok, i
On Error Resume Next
Set swApp = GetObject(, "SldWorks.Application")
If swApp Is Nothing Then Set swApp = CreateObject("SldWorks.Application")
If Err.Number <> 0 Then WScript.Echo "APP ERR:" & Err.Number: WScript.Quit 1
Set swModel = swApp.ActiveDoc
If swModel Is Nothing Then WScript.Echo "FAIL:no-doc": WScript.Quit 1
WScript.Echo "ActiveDoc:" & swModel.GetTitle
For i = 0 To 3
  Set swFeat = swModel.FeatureByPositionReverse(i)
  WScript.Echo "Feat" & i & ":" & swFeat.Name & " " & swFeat.GetTypeName2
Next
Set swFeat = swModel.FeatureByPositionReverse(0)
sketchName = swFeat.Name
Set swFM = swModel.FeatureManager
swModel.ClearSelection2 True
swFeat.Select2 False, 0
ok = swModel.Extension.SelectByID2("Line1@" & sketchName, "EXTSKETCHSEGMENT", 0, 0, 0, True, 16, Nothing, 0)
WScript.Echo "Axis:" & ok
Set swRev = swFM.FeatureRevolve2(True, True, False, False, False, False, 0, 0, ${Math.PI * 2}, 0, False, False, 0, 0, 0, 0, 0, True, False, True)
If Err.Number <> 0 Then WScript.Echo "REV ERR:" & Err.Number & " " & Err.Description
If swRev Is Nothing Then WScript.Echo "FAIL:null" Else WScript.Echo "OK:" & swRev.Name
`,
  'utf-8',
);

const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 120000 });
console.log(r.stdout?.trim());
