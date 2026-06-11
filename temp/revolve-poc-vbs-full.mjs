import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const R = 0.025;
const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const vbs = join(dir, 'revolve-full.vbs');

writeFileSync(vbs, `
Option Explicit
Dim swApp, swModel, swFeat, swSketch, segs, seg, i, swFM, swRev, angle, template

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
    seg.Select4 True, Nothing
    Exit For
  End If
Next

Set swFM = swModel.FeatureManager
Set swRev = swFM.FeatureRevolve2(False, False, angle, 0, 0, 0, True, True, 0, 0)
If swRev Is Nothing Then
  WScript.Echo "FAIL:null"
  WScript.Quit 2
End If
WScript.Echo "OK:" & swRev.Name
`, 'utf-8');

console.log('Running full VBS revolve...');
const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 120000 });
console.log('stdout:', r.stdout?.trim());
console.log('stderr:', r.stderr?.trim());
console.log('exit:', r.status);
