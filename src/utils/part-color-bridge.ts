import { spawnSync } from 'node:child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { logger } from './logger.js';

export interface PartColorResult {
  success: boolean;
  error?: string;
}

/** Apply RGB color to all faces of the active part solid body (VBScript COM bridge). */
export function setPartColorViaScriptBridge(
  documentTitle: string,
  r: number,
  g: number,
  b: number,
): PartColorResult {
  if (process.platform !== 'win32') {
    return { success: false, error: 'set_part_color requires Windows' };
  }

  const macroDir = join(tmpdir(), 'solidworks-mcp-macros');
  mkdirSync(macroDir, { recursive: true });
  const vbsPath = join(macroDir, `part_color_${Date.now()}.vbs`);
  const safeTitle = documentTitle.replace(/"/g, '""');

  const vbs = `Option Explicit
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
WScript.Echo "OK"
`;

  writeFileSync(vbsPath, vbs, 'utf-8');
  logger.info(`Running part color bridge: ${vbsPath}`);

  const result = spawnSync('cscript', ['//Nologo', vbsPath], {
    encoding: 'utf-8',
    timeout: 60000,
    windowsHide: true,
  });

  try {
    unlinkSync(vbsPath);
  } catch (_e) {
    // ignore
  }

  const stdout = (result.stdout || '').trim();
  if (stdout === 'OK') return { success: true };
  return { success: false, error: stdout.replace(/^ERR:/, '') || 'set_part_color failed' };
}
