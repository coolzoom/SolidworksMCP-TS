#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')

Write-Step 'Initializing Fasteners Workbench (import + ISO4762 table check)'

$freecadCmd = Find-FreeCadCmd
if (-not $freecadCmd) {
    Write-Err 'FreeCADCmd not found. Run install-freecad.bat first.'
    exit 1
}

$target = Get-FastenersModPath
if (-not (Test-Path -LiteralPath $target)) {
    Write-Err 'Fasteners Workbench not installed. Run install-fasteners.bat first.'
    exit 1
}

$initScript = @'
import FreeCAD as App
import ScrewMaker
import FastenersCmd
sm = ScrewMaker.Instance
lengths = sm.GetAllLengths('ISO4762', 'M3', True)
if '20' not in lengths:
    raise RuntimeError('ISO4762 M3 lengths missing expected value 20: ' + str(lengths))
App.Console.PrintMessage('Fasteners init OK. ISO4762 M3 lengths: ' + str(lengths) + '\n')
'@

& $freecadCmd -c $initScript
Assert-LastExitCode 'Fasteners initialization'
Write-Ok 'Fasteners Workbench initialized successfully'
