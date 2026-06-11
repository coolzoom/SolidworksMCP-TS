import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const R = 0.025;
const angle = Math.PI * 2;
const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const vbs = join(dir, 'black-sphere-full.vbs');

writeFileSync(
  vbs,
  `Option Explicit
Dim swApp, swModel, ext, sm, fm, feat, rev, sketchName, swPlane, i, f, status
Dim bodies, body, faces, face, j, mp, cfg

Const radius = ${R}
Const angle = ${angle}
On Error Resume Next

Set swApp = CreateObject("SldWorks.Application")
swApp.Visible = True
Set swModel = swApp.NewDocument(swApp.GetUserPreferenceStringValue(8), 0, 0, 0)
Set ext = swModel.Extension: Set sm = swModel.SketchManager: Set fm = swModel.FeatureManager

For i = 0 To swModel.GetFeatureCount()-1
  Set f = swModel.FeatureByPositionReverse(i)
  If f.GetTypeName2 = "RefPlane" Then Set swPlane = f: Exit For
Next
swPlane.Select2 False, 0
sm.InsertSketch True
sm.CreateCenterLine 0, -radius, 0, 0, radius, 0
sm.Create3PointArc 0, radius, 0, 0, -radius, 0, radius, 0, 0
sm.InsertSketch True
Set feat = swModel.FeatureByPositionReverse(0): sketchName = feat.Name

swModel.ClearSelection2 True
ext.SelectByID2 sketchName, "SKETCH", 0, 0, 0, False, 0, Nothing, 0
ext.SelectByID2 "Line1@" & sketchName, "EXTSKETCHSEGMENT", 0, radius / 2, 0, True, 1, Nothing, 0
Set rev = fm.FeatureRevolve2(True, True, False, False, False, False, 0, 0, angle, 0, False, False, 0, 0, 0, 0, 0, True, False, True)
If rev Is Nothing Then WScript.Echo "ERR:revolve": WScript.Quit 1
swModel.EditRebuild3

bodies = swModel.GetBodies2(0, True)
Set body = bodies(0)
faces = body.GetFaces()
For j = 0 To UBound(faces)
  Set face = faces(j)
  mp = face.GetMaterialPropertyValues("", "")
  If IsArray(mp) Then
    mp(0) = 0: mp(1) = 0: mp(2) = 0
    mp(3) = 1: mp(4) = 1: mp(5) = 1
    mp(6) = 0: mp(7) = 0.5: mp(8) = 0
    face.SetMaterialPropertyValues mp, "", ""
  End If
Next

swModel.ViewZoomtofit2
swModel.GraphicsRedraw2
WScript.Echo "OK:" & swModel.GetTitle & " Revolve=" & rev.Name
`,
  'utf-8',
);

console.log('Creating black sphere...');
const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 120000 });
console.log(r.stdout?.trim() || r.stderr?.trim());
