#Requires -Version 5.1
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')

$modRoot = Join-Path $env:APPDATA 'FreeCAD\v1-1\Mod'
$target = Get-FastenersModPath
$zip = Join-Path $env:TEMP 'FreeCAD_FastenersWB.zip'
$url = 'https://github.com/shaise/FreeCAD_FastenersWB/archive/refs/heads/master.zip'

Write-Step 'Checking Fasteners Workbench'

if ((Test-Path -LiteralPath $target) -and -not $Force) {
    Write-Ok "Fasteners already installed: $target"
    exit 0
}

if ($Force -and (Test-Path -LiteralPath $target)) {
    Write-Warn "Removing existing Fasteners install: $target"
    Remove-Item -LiteralPath $target -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $modRoot | Out-Null

Write-Step 'Downloading Fasteners Workbench'
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing

Write-Step "Installing Fasteners to $target"
Expand-Archive -Path $zip -DestinationPath $modRoot -Force
$extracted = Join-Path $modRoot 'FreeCAD_FastenersWB-master'
if (-not (Test-Path -LiteralPath $extracted)) {
    Write-Err 'Download archive did not contain FreeCAD_FastenersWB-master'
    exit 1
}
if (Test-Path -LiteralPath $target) {
    Remove-Item -LiteralPath $target -Recurse -Force
}
Rename-Item -LiteralPath $extracted -NewName 'Fasteners'
Remove-Item $zip -Force -ErrorAction SilentlyContinue

Write-Ok "Fasteners Workbench installed: $target"
