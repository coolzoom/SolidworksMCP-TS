import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'solidworks-mcp-macros');
mkdirSync(dir, { recursive: true });
const vbs = join(dir, 'body-debug.vbs');

writeFileSync(vbs, `Option Explicit
Dim swApp, swModel, rev, bodies, body, i, bt, f
Set swApp = CreateObject("SldWorks.Application")
Set swModel = swApp.ActiveDoc
If swModel Is Nothing Then WScript.Echo "no-doc": WScript.Quit 0
Set rev = swModel.FeatureByPositionReverse(0)
WScript.Echo "feat:" & rev.Name & " " & rev.GetTypeName2
On Error Resume Next
Set body = rev.GetBody
If Not body Is Nothing Then WScript.Echo "rev.GetBody:ok"
For bt = -1 To 3
  bodies = swModel.GetBodies2(bt, True)
  If Err.Number <> 0 Then
    WScript.Echo "GetBodies2(" & bt & ") err:" & Err.Description
    Err.Clear
  ElseIf IsEmpty(bodies) Then
    WScript.Echo "GetBodies2(" & bt & "):empty"
  ElseIf IsArray(bodies) Then
    WScript.Echo "GetBodies2(" & bt & "):array " & (UBound(bodies)+1)
  ElseIf bodies Is Nothing Then
    WScript.Echo "GetBodies2(" & bt & "):nothing"
  Else
    WScript.Echo "GetBodies2(" & bt & "):object"
  End If
Next
`, 'utf-8');

console.log(spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8' }).stdout?.trim());
