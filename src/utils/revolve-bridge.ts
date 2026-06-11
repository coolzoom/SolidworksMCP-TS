import { spawnSync } from 'node:child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { logger } from './logger.js';

export interface RevolveBridgeResult {
  success: boolean;
  featureName?: string;
  error?: string;
}

/**
 * Execute revolve via cscript/VBScript COM bridge.
 *
 * winax cannot select sketch segment axes (SelectByID2 type mismatch; GetSketchSegments
 * access violation). Native VBScript works with EXTSKETCHSEGMENT + FeatureRevolve2 (20 params).
 */
export function executeRevolveViaScriptBridge(
  documentTitle: string,
  angleDeg: number,
  reverse: boolean,
  axisPickYMeters = 0.001,
): RevolveBridgeResult {
  if (process.platform !== 'win32') {
    return { success: false, error: 'Revolve bridge requires Windows' };
  }

  const angleRad = (angleDeg * Math.PI) / 180;
  const macroDir = join(tmpdir(), 'solidworks-mcp-macros');
  mkdirSync(macroDir, { recursive: true });
  const vbsPath = join(macroDir, `revolve_bridge_${Date.now()}.vbs`);
  const safeTitle = documentTitle.replace(/"/g, '""');
  const reverseFlag = reverse ? 'True' : 'False';

  const vbs = `Option Explicit
Dim swApp, swModel, swFeat, swFM, swRev, sketchName, ok
Dim angle, docTitle, errMsg

docTitle = "${safeTitle}"
angle = ${angleRad}
errMsg = ""
On Error Resume Next

Set swApp = GetObject(, "SldWorks.Application")
If swApp Is Nothing Then Set swApp = CreateObject("SldWorks.Application")
If swApp Is Nothing Then
  WScript.Echo "ERR:Cannot connect to SolidWorks"
  WScript.Quit 1
End If

Set swModel = swApp.ActiveDoc
If Not swModel Is Nothing Then
  If swModel.GetTitle <> docTitle Then
    swApp.ActivateDoc3 docTitle, False, 0, 0
    Set swModel = swApp.ActiveDoc
  End If
End If

If swModel Is Nothing Then
  WScript.Echo "ERR:No active document"
  WScript.Quit 1
End If

Set swFeat = swModel.FeatureByPositionReverse(0)
If swFeat Is Nothing Then
  WScript.Echo "ERR:No sketch feature found"
  WScript.Quit 1
End If
sketchName = swFeat.Name

Set swFM = swModel.FeatureManager
swModel.ClearSelection2 True

' Select sketch profile then centerline axis (SW2023: EXTSKETCHSEGMENT, mark=1, pick on axis)
ok = swModel.Extension.SelectByID2(sketchName, "SKETCH", 0, 0, 0, False, 0, Nothing, 0)
If Not ok Then
  swFeat.Select2 False, 0
End If

ok = swModel.Extension.SelectByID2("Line1@" & sketchName, "EXTSKETCHSEGMENT", 0, ${axisPickYMeters}, 0, True, 1, Nothing, 0)
If Not ok Then
  ok = swModel.Extension.SelectByID2("Line1@" & sketchName, "EXTSKETCHSEGMENT", 0, 0, 0, True, 16, Nothing, 0)
End If

If Not ok Then
  WScript.Echo "ERR:Could not select revolve axis (centerline)"
  WScript.Quit 1
End If

Err.Clear
Set swRev = swFM.FeatureRevolve2( _
  True, True, False, False, ${reverseFlag}, False, _
  0, 0, angle, 0, _
  False, False, 0, 0, _
  0, 0, 0, _
  True, False, True)

If Err.Number <> 0 Then
  WScript.Echo "ERR:" & Err.Description
  WScript.Quit 1
End If

If swRev Is Nothing Then
  WScript.Echo "ERR:FeatureRevolve2 returned null"
  WScript.Quit 1
End If

swModel.ClearSelection2 True
swModel.EditRebuild3
WScript.Echo "OK:" & swRev.Name
WScript.Quit 0
`;

  writeFileSync(vbsPath, vbs, 'utf-8');
  logger.info(`Running revolve bridge: ${vbsPath}`);

  const result = spawnSync('cscript', ['//Nologo', vbsPath], {
    encoding: 'utf-8',
    timeout: 120000,
    windowsHide: true,
  });

  try {
    unlinkSync(vbsPath);
  } catch (_e) {
    // ignore cleanup errors
  }

  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();

  if (stdout.startsWith('OK:')) {
    return { success: true, featureName: stdout.slice(3) };
  }

  const errLine = stdout.startsWith('ERR:') ? stdout.slice(4) : stdout || stderr;
  return {
    success: false,
    error: errLine || `Revolve bridge failed (exit ${result.status})`,
  };
}
