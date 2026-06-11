import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const R = 0.025;
const angle = Math.PI * 2;
const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });

function run(label, body) {
  const vbs = join(dir, `rev-${label}.vbs`);
  writeFileSync(vbs, body, 'utf-8');
  const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 120000 });
  console.log(label + ':', (r.stdout || r.stderr || '').trim().split('\n')[0]);
}

const setup = `
Set swApp = CreateObject("SldWorks.Application")
swApp.Visible = True
template = swApp.GetUserPreferenceStringValue(8)
Set swModel = swApp.NewDocument(template, 0, 0, 0)
swModel.SketchManager.InsertSketch True
swModel.SketchManager.CreateCenterLine 0, -${R}, 0, 0, ${R}, 0
swModel.SketchManager.Create3PointArc -${R}, 0, 0, ${R}, 0, 0, 0, 0, 0
swModel.SketchManager.InsertSketch True
Set swFeat = swModel.FeatureByPositionReverse(0)
sketchName = swFeat.Name
Set swFM = swModel.FeatureManager
swModel.ClearSelection2 True
swFeat.Select2 False, 0
swModel.Extension.SelectByID2 "Line1@" & sketchName, "EXTSKETCHSEGMENT", 0, 0, 0, True, 16, Nothing, 0
On Error Resume Next
`;

const cases = {
  p11: `Set swRev = swFM.FeatureRevolve2(False, False, False, False, False, ${angle}, 0, 0, 0, 0, True)`,
  p12a: `Set swRev = swFM.FeatureRevolve2(True, False, False, False, False, ${angle}, 0, 0, 0, 0, 0, True)`,
  p12b: `Set swRev = swFM.FeatureRevolve2(False, False, False, False, False, ${angle}, 0, 0, 0, 0, 0, True)`,
  p13: `Set swRev = swFM.FeatureRevolve2(False, False, False, False, False, ${angle}, 0, 0, 0, 0, 0, True, True)`,
  p14: `Set swRev = swFM.FeatureRevolve2(False, False, False, False, False, ${angle}, 0, 0, 0, 0, 0, True, True, True)`,
  p16: `Set swRev = swFM.FeatureRevolve2(False, False, False, False, False, ${angle}, 0, 0, 0, 0, 0, True, True, True, 0, 0)`,
};

for (const [label, call] of Object.entries(cases)) {
  run(label, `Option Explicit\nDim swApp,swModel,swFeat,swFM,swRev,template,sketchName\n${setup}\n${call}\nIf Err.Number<>0 Then WScript.Echo "ERR:"&Err.Number ElseIf swRev Is Nothing Then WScript.Echo "null" Else WScript.Echo "OK:"&swRev.Name`);
}
