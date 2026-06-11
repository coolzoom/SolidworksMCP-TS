import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const radius = 0.025;
const angle = Math.PI * 2;
const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const vbs = join(dir, 'sphere-matrix.vbs');

writeFileSync(vbs, `Option Explicit
Dim swApp, swModel, ext, sm, fm, feat, rev, sketchName, status, swPlane, i, f
Const R = ${radius}
Const A = ${angle}

Set swApp = CreateObject("SldWorks.Application")
Set swModel = swApp.NewDocument(swApp.GetUserPreferenceStringValue(8), 0, 0, 0)
Set ext = swModel.Extension: Set sm = swModel.SketchManager: Set fm = swModel.FeatureManager
For i = 0 To swModel.GetFeatureCount()-1
  Set f = swModel.FeatureByPositionReverse(i)
  If f.GetTypeName2 = "RefPlane" Then Set swPlane = f: Exit For
Next
swPlane.Select2 False, 0
sm.InsertSketch True
sm.CreateCenterLine 0, -R, 0, 0, R, 0
sm.Create3PointArcCenter 0, 0, 0, 0, R, 0, 0, -R, 0
sm.InsertSketch True
Set feat = swModel.FeatureByPositionReverse(0): sketchName = feat.Name

Sub SelAxis(m, px, py)
  swModel.ClearSelection2 True
  ext.SelectByID2 sketchName, "SKETCH", 0, 0, 0, False, 0, Nothing, 0
  status = ext.SelectByID2("Line1@" & sketchName, "EXTSKETCHSEGMENT", px, py, 0, True, m, Nothing, 0)
End Sub

Sub TryRev(label, solid)
  Set rev = fm.FeatureRevolve2(True, solid, False, False, False, False, 0, 0, A, 0, False, False, 0, 0, 0, 0, 0, True, False, True)
  If rev Is Nothing Then WScript.Echo label & ":null" Else WScript.Echo label & ":OK:" & rev.Name
End Sub

Call SelAxis(1, 0, R/2): Call TryRev("m1-solid", True)
Call SelAxis(16, 0, 0): Call TryRev("m16-solid", True)
Call SelAxis(4, 0, R/2): Call TryRev("m4-solid", True)
Call SelAxis(1, 0, R/2): Call TryRev("m1-surf", False)
`, 'utf-8');

const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 120000 });
console.log(r.stdout?.trim());
