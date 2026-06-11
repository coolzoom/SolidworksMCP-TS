import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const vbs = join(dir, 'black-faces.vbs');

writeFileSync(
  vbs,
  `Option Explicit
Dim swApp, swModel, bodies, body, faces, face, i, j, mp, cfg
On Error Resume Next

Set swApp = CreateObject("SldWorks.Application")
Set swModel = swApp.ActiveDoc
If swModel Is Nothing Then WScript.Echo "ERR:no-doc": WScript.Quit 1

cfg = ""
bodies = swModel.GetBodies2(0, True)
If IsEmpty(bodies) Or bodies Is Nothing Then WScript.Echo "ERR:no-bodies": WScript.Quit 1

If IsArray(bodies) Then
  Set body = bodies(0)
Else
  Set body = bodies
End If

faces = body.GetFaces()
If IsEmpty(faces) Or faces Is Nothing Then WScript.Echo "ERR:no-faces": WScript.Quit 1

For j = 0 To UBound(faces)
  Set face = faces(j)
  mp = face.GetMaterialPropertyValues(cfg, "")
  If IsArray(mp) Then
    mp(0) = 0: mp(1) = 0: mp(2) = 0
    mp(3) = 1: mp(4) = 1: mp(5) = 1
    mp(6) = 0: mp(7) = 0: mp(8) = 0
    face.SetMaterialPropertyValues mp, cfg, ""
  End If
Next

swModel.GraphicsRedraw2
WScript.Echo "OK:black-faces"
`,
  'utf-8',
);

const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 60000 });
console.log(r.stdout?.trim() || r.stderr?.trim());
