import { spawnSync } from 'node:child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { logger } from './logger.js';

export interface BridgeResult {
  success: boolean;
  featureName?: string;
  error?: string;
}

function runVbs(scriptBody: string, label: string): BridgeResult {
  if (process.platform !== 'win32') {
    return { success: false, error: `${label} requires Windows` };
  }

  const macroDir = join(tmpdir(), 'solidworks-mcp-macros');
  mkdirSync(macroDir, { recursive: true });
  const vbsPath = join(macroDir, `${label}_${Date.now()}.vbs`);
  writeFileSync(vbsPath, scriptBody, 'utf-8');
  logger.info(`Running ${label}: ${vbsPath}`);

  const result = spawnSync('cscript', ['//Nologo', vbsPath], {
    encoding: 'utf-8',
    timeout: 120000,
    windowsHide: true,
  });

  try {
    unlinkSync(vbsPath);
  } catch (_e) {
    // ignore
  }

  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();
  if (stdout.startsWith('OK:')) {
    return { success: true, featureName: stdout.slice(3) };
  }
  const errLine = stdout.startsWith('ERR:') ? stdout.slice(4) : stdout || stderr;
  return { success: false, error: errLine || `${label} failed (exit ${result.status})` };
}

/** Revolve via VBScript — winax cannot select EXTSKETCHSEGMENT reliably. */
export function executeRevolveViaScriptBridge(
  documentTitle: string,
  angleDeg: number,
  reverse: boolean,
  axisPickYMeters = 0.001,
): BridgeResult {
  const angleRad = (angleDeg * Math.PI) / 180;
  const safeTitle = documentTitle.replace(/"/g, '""');
  const reverseFlag = reverse ? 'True' : 'False';

  return runVbs(
    `Option Explicit
Dim swApp, swModel, swFeat, swFM, swRev, sketchName, ok, docTitle, angle
docTitle = "${safeTitle}"
angle = ${angleRad}
On Error Resume Next
Set swApp = GetObject(, "SldWorks.Application")
If swApp Is Nothing Then Set swApp = CreateObject("SldWorks.Application")
Set swModel = swApp.ActiveDoc
If Not swModel Is Nothing Then
  If swModel.GetTitle <> docTitle Then
    swApp.ActivateDoc3 docTitle, False, 0, 0
    Set swModel = swApp.ActiveDoc
  End If
End If
If swModel Is Nothing Then WScript.Echo "ERR:No active document": WScript.Quit 1
Set swFeat = swModel.FeatureByPositionReverse(0)
If swFeat Is Nothing Then WScript.Echo "ERR:No sketch feature": WScript.Quit 1
sketchName = swFeat.Name
Set swFM = swModel.FeatureManager
swModel.ClearSelection2 True
swModel.Extension.SelectByID2 sketchName, "SKETCH", 0, 0, 0, False, 0, Nothing, 0
ok = swModel.Extension.SelectByID2("Line1@" & sketchName, "EXTSKETCHSEGMENT", 0, ${axisPickYMeters}, 0, True, 1, Nothing, 0)
If Not ok Then ok = swModel.Extension.SelectByID2("Line1@" & sketchName, "EXTSKETCHSEGMENT", 0, 0, 0, True, 16, Nothing, 0)
If Not ok Then WScript.Echo "ERR:Could not select revolve axis": WScript.Quit 1
Err.Clear
Set swRev = swFM.FeatureRevolve2(True, True, False, False, ${reverseFlag}, False, 0, 0, angle, 0, False, False, 0, 0, 0, 0, 0, True, False, True)
If Err.Number <> 0 Then WScript.Echo "ERR:" & Err.Description: WScript.Quit 1
If swRev Is Nothing Then WScript.Echo "ERR:FeatureRevolve2 returned null": WScript.Quit 1
swModel.ClearSelection2 True
swModel.EditRebuild3
WScript.Echo "OK:" & swRev.Name
`,
    'revolve_bridge',
  );
}

/** Set RGB display color on all solid-body faces. */
export function setPartColorViaScriptBridge(
  documentTitle: string,
  r: number,
  g: number,
  b: number,
): BridgeResult {
  const safeTitle = documentTitle.replace(/"/g, '""');
  return runVbs(
    `Option Explicit
Dim swApp, swModel, bodies, body, faces, face, j, mp
On Error Resume Next
Set swApp = GetObject(, "SldWorks.Application")
If swApp Is Nothing Then Set swApp = CreateObject("SldWorks.Application")
Set swModel = swApp.ActiveDoc
If Not swModel Is Nothing Then
  If swModel.GetTitle <> "${safeTitle}" Then
    swApp.ActivateDoc3 "${safeTitle}", False, 0, 0
    Set swModel = swApp.ActiveDoc
  End If
End If
If swModel Is Nothing Then WScript.Echo "ERR:No active document": WScript.Quit 1
bodies = swModel.GetBodies2(0, True)
Set body = bodies(0)
faces = body.GetFaces()
For j = 0 To UBound(faces)
  Set face = faces(j)
  mp = face.GetMaterialPropertyValues("", "")
  If IsArray(mp) Then
    mp(0) = ${r / 255}: mp(1) = ${g / 255}: mp(2) = ${b / 255}
    mp(3) = 1: mp(4) = 1: mp(5) = 1
    mp(6) = 0: mp(7) = 0.5: mp(8) = 0
    face.SetMaterialPropertyValues mp, "", ""
  End If
Next
swModel.GraphicsRedraw2
WScript.Echo "OK:color"
`,
    'part_color',
  );
}
