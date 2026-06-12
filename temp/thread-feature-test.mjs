import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const vbs = join(tmpdir(), 'solidworks-mcp-macros', 'thread-feature.vbs');
writeFileSync(
  vbs,
  `Option Explicit
Dim swApp, swModel, ext, sm, fm, f, status, swDef, threadData, edge
Set swApp = GetObject(, "SldWorks.Application")
Set swModel = swApp.NewDocument(swApp.GetUserPreferenceStringValue(8), 0, 0, 0)
Set ext = swModel.Extension: Set sm = swModel.SketchManager: Set fm = swModel.FeatureManager
ext.SelectByID2 "Front Plane", "PLANE", 0, 0, 0, False, 0, Nothing, 0
sm.InsertSketch True: sm.CreateCircle 0, 0, 0, 0.0015, 0, 0: sm.InsertSketch True
swModel.FeatureByPositionReverse(0).Select2 False, 0
Set f = fm.FeatureExtrusion3(True, False, False, 0, 0, 0.06, 0, False, False, False, False, 0, 0, False, False, False, False, True, True, True, 0, 0, False)
swModel.EditRebuild3
swModel.ClearSelection2 True
status = ext.SelectByRay(0.0015, 0, 0.0001, 0, 0, -1, 0.001, 1, True, 1, 0)
WScript.Echo "edge:" & status
On Error Resume Next: Err.Clear
Set swDef = fm.CreateDefinition(89)
If swDef Is Nothing Then Set swDef = fm.CreateDefinition(88)
If swDef Is Nothing Then Set swDef = fm.CreateDefinition(90)
If swDef Is Nothing Then WScript.Echo "CreateDefinition null": WScript.Quit 1
WScript.Echo "def type:" & TypeName(swDef)
swDef.InitializeThreadData 1, "Metric Die", "M3x0.5", 0.003, 0.0005, 0.06
swDef.AccessSelections swModel, Nothing
Set f = fm.CreateFeature(swDef)
If Err.Number <> 0 Then WScript.Echo "ERR:" & Err.Description
If f Is Nothing Then WScript.Echo "null" Else WScript.Echo "OK:" & f.Name & " " & f.GetTypeName2
`,
  'utf-8',
);

const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 120000 });
console.log((r.stdout || r.stderr || '').trim());
