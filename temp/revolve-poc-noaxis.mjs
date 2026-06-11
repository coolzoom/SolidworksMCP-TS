import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const R = 0.025;
const angle = Math.PI * 2;
const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const vbs = join(dir, 'revolve-noaxis.vbs');

writeFileSync(
  vbs,
  `Option Explicit
Dim swApp, swModel, swFeat, swFM, swRev, template
Set swApp = CreateObject("SldWorks.Application")
template = swApp.GetUserPreferenceStringValue(8)
Set swModel = swApp.NewDocument(template, 0, 0, 0)
swModel.SketchManager.InsertSketch True
swModel.SketchManager.CreateCenterLine 0, -${R}, 0, 0, ${R}, 0
swModel.SketchManager.Create3PointArc -${R}, 0, 0, ${R}, 0, 0, 0, 0, 0
swModel.SketchManager.InsertSketch True
Set swFeat = swModel.FeatureByPositionReverse(0)
Set swFM = swModel.FeatureManager
swModel.ClearSelection2 True
swFeat.Select2 False, 0
Set swRev = swFM.FeatureRevolve2(True, True, False, False, False, False, 0, 0, ${angle}, 0, False, False, 0, 0, 0, 0, 0, True, False, True)
If swRev Is Nothing Then WScript.Echo "no-axis:null" Else WScript.Echo "no-axis:" & swRev.Name
`,
  'utf-8',
);

console.log(spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8' }).stdout?.trim());
