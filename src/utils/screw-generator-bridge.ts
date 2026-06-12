import { spawnSync } from 'node:child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getIso4762Spec,
  mmToMeters,
  type HexSocketScrewSpec,
} from '../standards/iso4762.js';
import { logger } from './logger.js';

export interface HexSocketScrewParams {
  /** ISO size e.g. M3, M6 */
  size: string;
  /** Shank length under head (mm) */
  length: number;
  /** Head top edge chamfer (mm); omit for standard default */
  headChamferMm?: number;
  /** Add ISO cosmetic thread (includes helical display) */
  cosmeticThread?: boolean;
  /** Add head top outer edge chamfer */
  headChamfer?: boolean;
  /** Create new part (true) or use active document (false) */
  newDocument?: boolean;
}

export interface HexSocketScrewResult {
  success: boolean;
  partName?: string;
  features?: {
    shank?: string;
    head?: string;
    hexCut?: string;
    chamfer?: string;
    cosmeticThread?: string;
  };
  spec?: HexSocketScrewSpec;
  error?: string;
}

function buildVbs(spec: HexSocketScrewSpec, params: HexSocketScrewParams): string {
  const shankR = mmToMeters(spec.nominalDiameter / 2);
  const shankL = mmToMeters(params.length);
  const headR = mmToMeters(spec.headDiameter / 2);
  const headK = mmToMeters(spec.headHeight);
  const hexR = mmToMeters(spec.hexAf / Math.sqrt(3));
  const hexDepth = mmToMeters(spec.hexDepth);
  const totalZ = shankL + headK;
  const chamfer = mmToMeters(params.headChamferMm ?? spec.defaultHeadChamfer);
  const pitch = mmToMeters(spec.pitch);
  const majorD = mmToMeters(spec.nominalDiameter);
  const chamferAngle = Math.PI / 4;
  const doChamfer = params.headChamfer !== false;
  const doThread = params.cosmeticThread !== false;
  const newDoc = params.newDocument !== false;

  const newDocBlock = newDoc
    ? `
template = swApp.GetUserPreferenceStringValue(8)
If template = "" Or InStr(template, "2023") > 0 Then
  template = "C:\\ProgramData\\SolidWorks\\SOLIDWORKS 2026\\templates\\Part.prtdot"
End If
Set swModel = swApp.NewDocument(template, 0, 0, 0)
If swModel Is Nothing Then WScript.Echo "ERR:NewDocument": WScript.Quit 1
`
    : `
Set swModel = swApp.ActiveDoc
If swModel Is Nothing Then WScript.Echo "ERR:NoActiveDocument": WScript.Quit 1
`;

  const chamferBlock = doChamfer
    ? `
swModel.ClearSelection2 True
status = ext.SelectByRay(HEAD_R - 0.00005, 0, TOTAL_Z - 0.00005, 1, 0, 0, 0.001, 1, False, 0, 0)
If Not status Then status = ext.SelectByRay(HEAD_R * 0.99, 0, TOTAL_Z, 0, 0, -1, 0.001, 1, False, 0, 0)
If Not status Then WScript.Echo "ERR:chamfer-edge": WScript.Quit 1
Err.Clear
Set chamferFeat = fm.InsertFeatureChamfer(0, 0, CHAMFER, CHAMFER_ANGLE, 0, 0, 0, 0)
If chamferFeat Is Nothing Then WScript.Echo "ERR:chamfer": WScript.Quit 1
chamferName = chamferFeat.Name
swModel.EditRebuild3
`
    : `chamferName = ""`;

  const threadBlock = doThread
    ? `
swModel.ClearSelection2 True
status = ext.SelectByRay(SHANK_R - 0.00005, 0, -0.0001, 0, 0, 1, 0.001, 1, False, 1, 0)
If Not status Then status = ext.SelectByRay(SHANK_R - 0.00005, 0, 0.0001, 0, 0, -1, 0.001, 1, False, 1, 0)
If Not status Then WScript.Echo "ERR:thread-edge": WScript.Quit 1
Err.Clear
Set threadFeat = fm.InsertCosmeticThread3(1, "Metric Die", THREAD_SIZE, MAJOR_D, 0, SHANK_L, "")
If threadFeat Is Nothing Then WScript.Echo "ERR:cosmetic-thread " & Err.Description: WScript.Quit 1
threadName = threadFeat.Name
swModel.EditRebuild3
`
    : `threadName = ""`;

  return `Option Explicit
Dim swApp, swModel, ext, sm, fm, feat, shankFeat, headFeat, cutFeat, chamferFeat, threadFeat, status
Dim j, ang, hx, hy, hx2, hy2, template, errMsg
Dim shankName, headName, cutName, chamferName, threadName

Dim SHANK_R, SHANK_L, HEAD_R, HEAD_K, HEX_R, HEX_DEPTH, TOTAL_Z, CHAMFER, CHAMFER_ANGLE
Dim PITCH, MAJOR_D, THREAD_SIZE

SHANK_R = ${shankR}
SHANK_L = ${shankL}
HEAD_R = ${headR}
HEAD_K = ${headK}
HEX_R = ${hexR}
HEX_DEPTH = ${hexDepth}
TOTAL_Z = ${totalZ}
CHAMFER = ${chamfer}
CHAMFER_ANGLE = ${chamferAngle}
PITCH = ${pitch}
MAJOR_D = ${majorD}
THREAD_SIZE = "${spec.threadSize}"

On Error Resume Next
Set swApp = GetObject(, "SldWorks.Application")
If swApp Is Nothing Then Set swApp = CreateObject("SldWorks.Application")
swApp.Visible = True
${newDocBlock}
Set ext = swModel.Extension
Set sm = swModel.SketchManager
Set fm = swModel.FeatureManager

' --- Shank ---
swModel.ClearSelection2 True
ext.SelectByID2 "Front Plane", "PLANE", 0, 0, 0, False, 0, Nothing, 0
sm.InsertSketch True
sm.CreateCircle 0, 0, 0, SHANK_R, 0, 0
sm.InsertSketch True
Set feat = swModel.FeatureByPositionReverse(0)
swModel.ClearSelection2 True
feat.Select2 False, 0
Set shankFeat = fm.FeatureExtrusion3(True, False, False, 0, 0, SHANK_L, 0, False, False, False, False, 0, 0, False, False, False, False, True, True, True, 0, 0, False)
If shankFeat Is Nothing Then WScript.Echo "ERR:shank": WScript.Quit 1
shankName = shankFeat.Name
swModel.EditRebuild3

' --- Head ---
swModel.ClearSelection2 True
status = ext.SelectByRay(0, 0, SHANK_L - 0.0001, 0, 0, 1, 0.001, 2, False, 0, 0)
If Not status Then WScript.Echo "ERR:shank-top-face": WScript.Quit 1
sm.InsertSketch True
sm.CreateCircle 0, 0, 0, HEAD_R, 0, 0
sm.InsertSketch True
Set feat = swModel.FeatureByPositionReverse(0)
swModel.ClearSelection2 True
feat.Select2 False, 0
Set headFeat = fm.FeatureExtrusion3(True, False, False, 0, 0, HEAD_K, 0, False, False, False, False, 0, 0, False, False, False, False, True, True, True, 0, 0, False)
If headFeat Is Nothing Then WScript.Echo "ERR:head": WScript.Quit 1
headName = headFeat.Name
swModel.EditRebuild3

' --- Hex socket ---
swModel.ClearSelection2 True
status = ext.SelectByRay(0, 0, TOTAL_Z - 0.0001, 0, 0, 1, 0.001, 2, False, 0, 0)
If Not status Then WScript.Echo "ERR:head-top-face": WScript.Quit 1
sm.InsertSketch True
For j = 0 To 5
  ang = j * 3.14159265358979 / 3
  hx = HEX_R * Cos(ang)
  hy = HEX_R * Sin(ang)
  ang = (j + 1) * 3.14159265358979 / 3
  hx2 = HEX_R * Cos(ang)
  hy2 = HEX_R * Sin(ang)
  sm.CreateLine hx, hy, 0, hx2, hy2, 0
Next
sm.InsertSketch True
Set feat = swModel.FeatureByPositionReverse(0)
swModel.ClearSelection2 True
feat.Select2 False, 0
Err.Clear
Set cutFeat = fm.FeatureCut4(True, False, False, 0, 0, HEX_DEPTH, 0, False, False, False, False, 0, 0, False, False, False, False, False, True, True, True, True, False, 0, 0, False, False)
If cutFeat Is Nothing Then WScript.Echo "ERR:hex-cut " & Err.Description: WScript.Quit 1
cutName = cutFeat.Name
swModel.EditRebuild3
${threadBlock}
${chamferBlock}
swModel.ViewZoomtofit2
WScript.Echo "OK:" & swModel.GetTitle & "|" & shankName & "|" & headName & "|" & cutName & "|" & chamferName & "|" & threadName
`;
}

/** Generate ISO 4762 hex socket head cap screw via VBScript bridge (SW 2026 reliable path). */
export function createHexSocketScrewViaBridge(params: HexSocketScrewParams): HexSocketScrewResult {
  if (process.platform !== 'win32') {
    return { success: false, error: 'Hex socket screw generation requires Windows + SolidWorks' };
  }

  if (params.length <= 0 || params.length > 500) {
    return { success: false, error: 'length must be between 0 and 500 mm' };
  }

  let spec: HexSocketScrewSpec;
  try {
    spec = getIso4762Spec(params.size);
  } catch (e) {
    return { success: false, error: String(e) };
  }

  const macroDir = join(tmpdir(), 'solidworks-mcp-macros');
  mkdirSync(macroDir, { recursive: true });
  const vbsPath = join(macroDir, `hex_screw_${Date.now()}.vbs`);
  writeFileSync(vbsPath, buildVbs(spec, params), 'utf-8');
  logger.info(`Generating ${spec.designation} x ${params.length}mm screw: ${vbsPath}`);

  const result = spawnSync('cscript', ['//Nologo', vbsPath], {
    encoding: 'utf-8',
    timeout: 180000,
    windowsHide: true,
  });

  try {
    unlinkSync(vbsPath);
  } catch (_e) {
    // ignore
  }

  const stdout = (result.stdout || '').trim();
  if (!stdout.startsWith('OK:')) {
    const errLine = stdout.startsWith('ERR:') ? stdout.slice(4) : stdout || result.stderr || 'Unknown error';
    return { success: false, spec, error: errLine };
  }

  const payload = stdout.slice(3);
  const [partName, shank, head, hexCut, chamfer, cosmeticThread] = payload.split('|');

  return {
    success: true,
    partName,
    spec,
    features: {
      shank,
      head,
      hexCut,
      ...(chamfer ? { chamfer } : {}),
      ...(cosmeticThread ? { cosmeticThread } : {}),
    },
  };
}
