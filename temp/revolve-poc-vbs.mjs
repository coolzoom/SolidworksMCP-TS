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

const sketchName = model.FeatureByPositionReverse(0).Name;
console.log('Sketch ready:', sketchName, 'Title:', model.GetTitle());

const vbsDir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(vbsDir, { recursive: true });
const vbsPath = join(vbsDir, 'revolve-sphere.vbs');

const vbs = `
Option Explicit
Dim swApp, swModel, swFeat, swSketch, segs, seg, i, swFM, swRev, angle
Set swApp = GetObject(, "SldWorks.Application")
Set swModel = swApp.ActiveDoc
If swModel Is Nothing Then WScript.Echo "No active doc": WScript.Quit 1

angle = ${Math.PI * 2}
swModel.ClearSelection2 True
Set swFeat = swModel.FeatureByPositionReverse(0)
swFeat.Select2 False, 0

Set swSketch = swFeat.GetSpecificFeature2
segs = swSketch.GetSketchSegments
For i = 0 To UBound(segs)
  Set seg = segs(i)
  If seg.ConstructionGeometry Then
    seg.Select4 True, Nothing
    Exit For
  End If
Next

Set swFM = swModel.FeatureManager
Set swRev = swFM.FeatureRevolve2(False, False, angle, 0, 0, 0, True, True, 0, 0)
If swRev Is Nothing Then
  WScript.Echo "FeatureRevolve2 null"
  WScript.Quit 2
End If
swModel.EditRebuild3
WScript.Echo "OK:" & swRev.Name
`;

writeFileSync(vbsPath, vbs, 'utf-8');
console.log('Running VBS:', vbsPath);

const result = spawnSync('cscript', ['//Nologo', vbsPath], { encoding: 'utf-8', timeout: 60000 });
console.log('stdout:', result.stdout?.trim());
console.log('stderr:', result.stderr?.trim());
console.log('exit:', result.status);

try {
  const latest = model.FeatureByPositionReverse(0);
  console.log('Latest feature:', latest?.Name, latest?.GetTypeName2?.());
} catch (e) {
  console.log('check ERR', e);
}
