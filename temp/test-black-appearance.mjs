import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });

const scripts = {
  mat1: `
Set swApp = CreateObject("SldWorks.Application")
Set swModel = swApp.ActiveDoc
If swModel Is Nothing Then WScript.Echo "ERR:no-doc": WScript.Quit 1
ok = swModel.Extension.SetMaterialPropertyName2("Default", "solidworks materials.sldmat", "Rubber - Black")
WScript.Echo "SetMaterial:" & ok
`,
  mat2: `
Set swApp = CreateObject("SldWorks.Application")
Set swModel = swApp.ActiveDoc
Set rm = swModel.Extension.CreateRenderMaterial("Plain Black")
If rm Is Nothing Then WScript.Echo "ERR:no-rm": WScript.Quit 1
rm.PrimaryColor = 0
rm.DiffuseColor = 0
ok = swModel.Extension.AddRenderMaterial(rm, 1)
WScript.Echo "AddRenderMaterial:" & ok
`,
  mat3: `
Set swApp = CreateObject("SldWorks.Application")
Set swModel = swApp.ActiveDoc
swModel.ClearSelection2 True
Set feat = swModel.FeatureByPositionReverse(0)
If feat Is Nothing Then WScript.Echo "ERR:no-feat": WScript.Quit 1
feat.Select2 False, 0
ok = swModel.Extension.SetMaterialPropertyName2("Default", "solidworks materials.sldmat", "Plain Carbon Fiber")
WScript.Echo "feat-mat:" & ok
`,
};

for (const [name, body] of Object.entries(scripts)) {
  const vbs = join(dir, `black-${name}.vbs`);
  writeFileSync(vbs, `Option Explicit\nDim swApp, swModel, ok, feat, rm\nOn Error Resume Next\n${body}`, 'utf-8');
  const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 60000 });
  console.log(name + ':', (r.stdout || r.stderr || '').trim().split('\n')[0]);
}
