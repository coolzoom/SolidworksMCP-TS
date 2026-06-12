# Install Fasteners Workbench into the current user's FreeCAD Mod folder.
# Equivalent to: Tools -> Addon Manager -> Fasteners -> Install

$modRoot = Join-Path $env:APPDATA "FreeCAD\v1-1\Mod"
$target = Join-Path $modRoot "Fasteners"
$zip = Join-Path $env:TEMP "FreeCAD_FastenersWB.zip"
$url = "https://github.com/shaise/FreeCAD_FastenersWB/archive/refs/heads/master.zip"

New-Item -ItemType Directory -Force -Path $modRoot | Out-Null

if (Test-Path -LiteralPath $target) {
    Write-Host "Fasteners Workbench already installed: $target"
    exit 0
}

Write-Host "Downloading Fasteners Workbench..."
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing

Write-Host "Installing to $target ..."
Expand-Archive -Path $zip -DestinationPath $modRoot -Force
Rename-Item (Join-Path $modRoot "FreeCAD_FastenersWB-master") "Fasteners"
Remove-Item $zip -Force -ErrorAction SilentlyContinue

Write-Host "Installed. Restart FreeCAD, then select the Fasteners workbench."
