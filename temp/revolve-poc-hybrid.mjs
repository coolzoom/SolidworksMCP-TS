import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { loadWinax } from '../dist/adapters/winax-loader.js';
import { SolidWorksConfig } from '../dist/utils/solidworks-config.js';

const R = 0.025;
const angle = Math.PI * 2;

// Part 1: winax creates sketch (like MCP workflow)
const winax = loadWinax();
const swApp = new winax.Object('SldWorks.Application');
const model = swApp.NewDocument(SolidWorksConfig.getTemplatePath(swApp, 'part'), 0, 0, 0);
model.SketchManager.InsertSketch(true);
model.SketchManager.CreateCenterLine(0, -R, 0, 0, R, 0);
model.SketchManager.Create3PointArc(-R, 0, 0, R, 0, 0, 0, 0, 0);
model.SketchManager.InsertSketch(true);
console.log('Winax sketch ready on', model.GetTitle());

// Part 2: VBS completes revolve on ActiveDoc
const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const vbs = join(dir, 'revolve-bridge.vbs');
writeFileSync(
  vbs,
  `Option Explicit
Dim swApp, swModel, swFeat, swFM, swRev, sketchName
Set swApp = CreateObject("SldWorks.Application")
Set swModel = swApp.ActiveDoc
If swModel Is Nothing Then WScript.Echo "FAIL:no-doc": WScript.Quit 1
Set swFeat = swModel.FeatureByPositionReverse(0)
sketchName = swFeat.Name
Set swFM = swModel.FeatureManager
swModel.ClearSelection2 True
swFeat.Select2 False, 0
swModel.Extension.SelectByID2 "Line1@" & sketchName, "EXTSKETCHSEGMENT", 0, 0, 0, True, 16, Nothing, 0
Set swRev = swFM.FeatureRevolve2(True, True, False, False, False, False, 0, 0, ${angle}, 0, False, False, 0, 0, 0, 0, 0, True, False, True)
If swRev Is Nothing Then WScript.Echo "FAIL:null": WScript.Quit 2
swModel.EditRebuild3
WScript.Echo "OK:" & swRev.Name
`,
  'utf-8',
);

const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 120000 });
console.log('Bridge:', r.stdout?.trim() || r.stderr?.trim());

try {
  const latest = model.FeatureByPositionReverse(0);
  console.log('Latest via winax:', latest?.GetTypeName2?.(), latest?.GetName?.());
} catch (e) {
  console.log('Check ERR', e);
}
