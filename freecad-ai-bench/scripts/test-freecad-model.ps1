#Requires -Version 5.1
<#
.SYNOPSIS
  Generate ISO4762 screw via FreeCADCmd (no MCP / RPC required).
#>
param(
    [Parameter(Mandatory = $false)]
    [string]$Size = 'M3',
    [Parameter(Mandatory = $false)]
    [double]$Length = 20
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')

if ($Size -match '^\d') {
    throw "Invalid -Size '$Size'. Use -Size M3 -Length 20 (Size is e.g. M3/M5, Length is mm)."
}
if ($Length -le 0) {
    throw "Invalid -Length '$Length'. Length must be a positive number in mm."
}

$benchRoot = Get-BenchRoot
$outDir = Join-Path $benchRoot 'output'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$fcstd = Join-Path $outDir "${Size}x${Length}_iso4762_threaded.FCStd"
$step = [System.IO.Path]::ChangeExtension($fcstd, '.step')
$pyScript = Join-Path $benchRoot 'python\freecad-iso4762-screw.py'

$freecadCmd = Find-FreeCadCmd
if (-not $freecadCmd) {
    Write-Err 'FreeCADCmd not found'
    exit 1
}
if (-not (Test-Path -LiteralPath $pyScript)) {
    Write-Err "Missing generator script: $pyScript"
    exit 1
}
if (-not (Test-Path -LiteralPath (Get-FastenersModPath))) {
    Write-Err 'Fasteners Workbench not installed'
    exit 1
}

Write-Step "Generating ${Size}x${Length} ISO4762 screw with real thread"

$env:SCREW_SIZE = $Size
$env:SCREW_LENGTH = "$Length"
$env:SCREW_THREAD = 'real'
$env:SCREW_OUTPUT = $fcstd

& $freecadCmd $pyScript
Assert-LastExitCode 'FreeCAD model generation'

foreach ($file in @($fcstd, $step)) {
    if (-not (Test-Path -LiteralPath $file)) {
        Write-Err "Expected output missing: $file"
        exit 1
    }
    $bytes = (Get-Item -LiteralPath $file).Length
    if ($bytes -lt 512) {
        Write-Err "Output too small ($bytes bytes): $file"
        exit 1
    }
    Write-Ok "$file ($bytes bytes)"
}

Write-Ok 'FreeCAD model generation test passed'
