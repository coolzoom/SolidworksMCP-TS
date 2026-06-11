import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });

const tries = [
  ['part-mat', `
Set swModel = swApp.ActiveDoc
ok = swModel.SetMaterialPropertyName2("", "solidworks materials.sldmat", "Rubber - Black")
WScript.Echo ok`],
  ['ext-mat', `
Set swModel = swApp.ActiveDoc
ok = swModel.Extension.SetMaterialPropertyName2("Default", "solidworks materials.sldmat", "Rubber - Black")
WScript.Echo ok`],
  ['revolve-feat', `
Set swModel = swApp.ActiveDoc
Set feat = swModel.FeatureByPositionReverse(0)
WScript.Echo feat.Name
feat.Select2 False, 0
ok = swModel.Extension.SetMaterialPropertyName2("Default", "solidworks materials.sldmat", "Rubber - Black")
WScript.Echo ok`],
  ['color-rgb', `
Set swModel = swApp.ActiveDoc
swModel.ClearSelection2 True
swModel.Extension.SelectByRay 0.025, 0, 0, -1, 0, 0, 0.001, 2, False, 0, 0
Set rm = swModel.Extension.CreateRenderMaterial("Plain Black", "")
If rm Is Nothing Then WScript.Echo "null-rm": WScript.Quit 0
rm.PrimaryColor = 0
ok = swModel.Extension.AddRenderMaterial(rm, 1)
WScript.Echo ok`],
];

for (const [name, body] of tries) {
  const vbs = join(dir, `b-${name}.vbs`);
  writeFileSync(
    vbs,
    `Option Explicit\nDim swApp, swModel, ok, feat\nSet swApp = CreateObject("SldWorks.Application")\nSet swModel = swApp.ActiveDoc\nIf swModel Is Nothing Then WScript.Echo "no-doc": WScript.Quit 0\n${body}`,
    'utf-8',
  );
  const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 60000 });
  console.log(name + ':', (r.stdout || r.stderr || '').trim().replace(/\n/g, ' | '));
}
