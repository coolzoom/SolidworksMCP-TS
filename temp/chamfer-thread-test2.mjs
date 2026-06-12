import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });

function baseBody() {
  return `
Set swApp = GetObject(, "SldWorks.Application")
Set swModel = swApp.NewDocument(swApp.GetUserPreferenceStringValue(8), 0, 0, 0)
Set ext = swModel.Extension: Set sm = swModel.SketchManager: Set fm = swModel.FeatureManager
ext.SelectByID2 "Front Plane", "PLANE", 0, 0, 0, False, 0, Nothing, 0
sm.InsertSketch True: sm.CreateCircle 0, 0, 0, 0.0015, 0, 0: sm.InsertSketch True
swModel.FeatureByPositionReverse(0).Select2 False, 0
fm.FeatureExtrusion3 True, False, False, 0, 0, 0.06, 0, False, False, False, False, 0, 0, False, False, False, False, True, True, True, 0, 0, False
ext.SelectByRay 0, 0, 0.059999, 0, 0, 1, 0.001, 2, False, 0, 0
sm.InsertSketch True: sm.CreateCircle 0, 0, 0, 0.00275, 0, 0: sm.InsertSketch True
swModel.FeatureByPositionReverse(0).Select2 False, 0
fm.FeatureExtrusion3 True, False, False, 0, 0, 0.003, 0, False, False, False, False, 0, 0, False, False, False, False, True, True, True, 0, 0, False
swModel.EditRebuild3
`;
}

function run(label, body) {
  const vbs = join(dir, `${label}.vbs`);
  writeFileSync(vbs, `Option Explicit\nDim swApp, swModel, ext, sm, fm, f, status\n${baseBody()}\n${body}`, 'utf-8');
  const r = spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8', timeout: 120000 });
  console.log(`${label}:`, (r.stdout || '').trim());
}

run(
  'chamfer-insert',
  `
swModel.ClearSelection2 True
status = ext.SelectByRay(0.00274, 0, 0.062999, 1, 0, 0, 0.001, 1, False, 0, 0)
WScript.Echo "sel:" & status
On Error Resume Next: Err.Clear
' InsertFeatureChamfer(Options, ChamferType, Width, Angle, OtherDist, V1, V2, V3)
' swChamferAngleDistance=0, 45deg=0.785398163, width=0.0002m
Set f = fm.InsertFeatureChamfer(0, 0, 0.0002, 0.785398163397448, 0, 0, 0, 0)
If Err.Number <> 0 Then WScript.Echo "ERR:" & Err.Description
If f Is Nothing Then WScript.Echo "null" Else WScript.Echo "OK:" & f.Name & " type=" & f.GetTypeName2
`,
);

const threadTests = [
  ['th3-metric', 1, 'Metric Die', 'M3x0.5', 0.003],
  ['th3-iso', 2, 'ISO', 'M3x0.5', 0.003],
  ['th3-none', -1, 'Metric Die', 'M3x0.5', 0.003],
  ['th3-machine', 0, 'Machine Threads', 'M3x0.5', 0.003],
];

for (const [label, std, stdType, size, dia] of threadTests) {
  run(
    label,
    `
swModel.ClearSelection2 True
status = ext.SelectByRay(0.0015, 0, 0.0001, 0, 0, -1, 0.001, 1, True, 1, 0)
If Not status Then status = ext.SelectByRay(0.0015, 0, 0, 1, 0, 0, 0.001, 1, True, 1, 0)
WScript.Echo "sel:" & status
On Error Resume Next: Err.Clear
' EndType 0=blind, Depth=0.06
Set f = fm.InsertCosmeticThread3(${std}, "${stdType}", "${size}", ${dia}, 0, 0.06, "")
If Err.Number <> 0 Then WScript.Echo "ERR:" & Err.Description
If f Is Nothing Then WScript.Echo "null" Else WScript.Echo "OK:" & f.Name & " type=" & f.GetTypeName2
`,
  );
}

// Helix via InsertHelix2 or sketch spiral
run(
  'helix2',
  `
swModel.ClearSelection2 True
ext.SelectByID2 "Front Plane", "PLANE", 0, 0, 0, False, 0, Nothing, 0
sm.InsertSketch True
sm.CreateCircle 0, 0, 0, 0.0015, 0, 0
sm.InsertSketch True
swModel.FeatureByPositionReverse(0).Select2 False, 0
On Error Resume Next: Err.Clear
Set f = fm.InsertHelix False, True, False, False, 0.0005, 0.06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
If Err.Number <> 0 Then WScript.Echo "ERR:" & Err.Description
If f Is Nothing Then WScript.Echo "null" Else WScript.Echo "OK:" & f.Name & " type=" & f.GetTypeName2
`,
);
