import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const vbs = join(tmpdir(), 'solidworks-mcp-macros', 'check-screw.vbs');
writeFileSync(vbs, `Option Explicit
Dim swApp, swModel, i, f
Set swApp = CreateObject("SldWorks.Application")
Set swModel = swApp.ActiveDoc
If swModel Is Nothing Then WScript.Echo "no-doc": WScript.Quit 0
WScript.Echo "Title:" & swModel.GetTitle
For i = 0 To 8
  Set f = swModel.FeatureByPositionReverse(i)
  If f Is Nothing Then Exit For
  WScript.Echo i & ":" & f.Name & " " & f.GetTypeName2
Next
`, 'utf-8');
console.log(spawnSync('cscript', ['//Nologo', vbs], { encoding: 'utf-8' }).stdout?.trim());
