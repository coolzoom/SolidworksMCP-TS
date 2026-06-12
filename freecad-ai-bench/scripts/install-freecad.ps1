#Requires -Version 5.1
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')

Write-Step 'Checking FreeCAD installation'

$existing = Find-FreeCadCmd
if ($existing -and -not $Force) {
    Write-Ok "FreeCADCmd found: $existing"
    exit 0
}

if (-not (Test-WingetAvailable)) {
    Write-Err 'winget is required to auto-install FreeCAD. Install from https://www.freecad.org/downloads.php'
    exit 1
}

Write-Step 'Installing FreeCAD 1.x via winget (FreeCAD.FreeCAD)'
$proc = Start-Process -FilePath 'winget' -ArgumentList @(
    'install', '--id', 'FreeCAD.FreeCAD', '-e',
    '--accept-package-agreements', '--accept-source-agreements',
    '--disable-interactivity'
) -Wait -PassThru -NoNewWindow

if ($proc.ExitCode -ne 0 -and $proc.ExitCode -ne -1978335189) {
    Write-Err "winget install failed (exit $($proc.ExitCode))"
    exit $proc.ExitCode
}

Start-Sleep -Seconds 3
Refresh-PathEnv

$installed = Find-FreeCadCmd
if (-not $installed) {
    Write-Err 'FreeCAD install finished but FreeCADCmd was not found'
    exit 1
}

Write-Ok "FreeCAD installed: $installed"
