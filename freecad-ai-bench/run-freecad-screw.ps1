# Run ISO 4762 screw generator in FreeCAD (headless).
# Example: .\scripts\run-freecad-screw.ps1 -Size M3 -Length 20

param(
    [string]$Size = "M3",
    [double]$Length = 20,
    [string]$Output = "",
    [switch]$RealThread,
    [switch]$SimpleThread,
    [switch]$NoThread
)

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptRoot
$pyScript = Join-Path $scriptRoot "freecad-iso4762-screw.py"

if (-not $Output) {
    $outDir = Join-Path $repoRoot "output"
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    $suffix = if ($SimpleThread -or $NoThread) { "iso4762" } else { "iso4762_threaded" }
    $Output = Join-Path $outDir "${Size}x${Length}_${suffix}.FCStd"
}

$candidates = @(
    "$env:LOCALAPPDATA\Programs\FreeCAD *\bin\freecadcmd.exe",
    "$env:ProgramFiles\FreeCAD *\bin\FreeCADCmd.exe",
    "${env:ProgramFiles(x86)}\FreeCAD *\bin\FreeCADCmd.exe"
)

$freecadCmd = $null
foreach ($pattern in $candidates) {
    $match = Get-Item $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($match) {
        $freecadCmd = $match.FullName
        break
    }
}

if (-not $freecadCmd) {
    Write-Error @"
FreeCADCmd not found.

Install FreeCAD 1.x, then rerun:
  winget install --id FreeCAD.FreeCAD -e

Or open FreeCAD GUI -> Macro -> run:
  $pyScript
"@
    exit 1
}

$outDir = Split-Path -Parent $Output
if (-not (Test-Path -LiteralPath $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

$env:SCREW_SIZE = $Size
$env:SCREW_LENGTH = "$Length"
if ($NoThread) {
    $env:SCREW_THREAD = "none"
} elseif ($SimpleThread) {
    $env:SCREW_THREAD = "simple"
} else {
    $env:SCREW_THREAD = "real"
}
$resolvedOutput = Resolve-Path -LiteralPath $Output -ErrorAction SilentlyContinue
if ($resolvedOutput) {
    $env:SCREW_OUTPUT = $resolvedOutput.Path
} else {
    $env:SCREW_OUTPUT = (Join-Path (Resolve-Path -LiteralPath $outDir).Path (Split-Path -Leaf $Output))
}

& $freecadCmd $pyScript
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Created: $Output"
Write-Host "Created: $([System.IO.Path]::ChangeExtension($Output, '.step'))"
