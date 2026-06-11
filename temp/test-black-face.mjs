import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const vbs = join(dir, 'black-face.vbs');

writeFileSync(
  vbs,
  `Option Explicit
Dim swApp, swModel, ext, rm, ok, status
On Error Resume Next

Set swApp = CreateObject("SldWorks.Application")
Set swModel = swApp.ActiveDoc
If swModel Is Nothing Then WScript.Echo "ERR:no-doc": WScript.Quit 1
Set ext = swModel.Extension

swModel.ClearSelection2 True
' Pick a face on the sphere surface
status = ext.SelectByRay(0.025, 0, 0, -1, 0, 0, 0.001, 2, False, 0, 0)
WScript.Echo "SelectByRay:" & status

Set rm = ext.CreateRenderMaterial("Plain Black")
If rm Is Nothing Then
  Set rm = ext.CreateRenderMaterial("Black")
End If
If rm Is Nothing Then WScript.Echo "ERR:CreateRenderMaterial": WScript.Quit 1

rm.PrimaryColor = 0
rm.SecondaryColor = 0
rm.DiffuseColor = 0
rm.AmbientColor = 0
rm.Transparency = 0
rm.SpecularColor = 0

Err.Clear
ok = ext.AddRenderMaterial(rm, 1)
If Err.Number <> 0 Then WScript.Echo "ERR:" & Err.Description: WScript.Quit 1
WScript.Echo "OK:" & ok
swModel.GraphicsRedraw2
`,
  'utf-8',
);

const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 60000 });
console.log(r.stdout?.trim());
console.log(r.stderr?.trim());
