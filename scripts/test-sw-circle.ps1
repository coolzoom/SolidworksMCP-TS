# Direct SolidWorks COM test - create part, sketch, circle (bypasses MCP/winax)
# Usage: powershell -ExecutionPolicy Bypass -File scripts/test-sw-circle.ps1

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "=== SolidWorks Direct COM Circle Test ===" -ForegroundColor Cyan
Write-Host ""

$sw = New-Object -ComObject SldWorks.Application
$sw.Visible = $true
Write-Host "[OK]   Connected to SolidWorks" -ForegroundColor Green

$model = $sw.ActiveDoc
if (-not $model) {
    $template = Get-ChildItem 'C:\ProgramData\SolidWorks' -Filter 'Part.prtdot' -Recurse -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName

    if (-not $template) {
        Write-Host "[ERR]  No Part.prtdot template found under ProgramData\SolidWorks" -ForegroundColor Red
        exit 1
    }

    Write-Host "[INFO] Using template: $template"
    $errors = 0
    $warnings = 0
    $model = $sw.NewDocument($template, 0, 0, 0, [ref]$errors, [ref]$warnings)

    if (-not $model) {
        Write-Host "[ERR]  NewDocument failed (errors=$errors warnings=$warnings)" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK]   Created part document" -ForegroundColor Green
} else {
    Write-Host "[OK]   Using active document: $($model.GetTitle)" -ForegroundColor Green
}

$model.ClearSelection2($true) | Out-Null
$selected = $model.Extension.SelectByID2('Front Plane', 'PLANE', 0, 0, 0, $false, 0, $null, 0)
if (-not $selected) {
    Write-Host "[WARN] Could not select Front Plane, attempting sketch anyway" -ForegroundColor Yellow
}

$model.SketchManager.InsertSketch($true) | Out-Null
Write-Host "[OK]   Inserted sketch on Front plane" -ForegroundColor Green

$radiusM = 0.025
$circle = $model.SketchManager.CreateCircle(0, 0, 0, $radiusM, 0, 0)

if (-not $circle) {
    Write-Host "[ERR]  CreateCircle returned null" -ForegroundColor Red
    exit 1
}

$model.SketchManager.InsertSketch($true) | Out-Null
$model.EditRebuild3() | Out-Null

Write-Host "[OK]   Circle created (radius 25 mm)" -ForegroundColor Green
Write-Host ""
Write-Host "=== SolidWorks COM test PASSED - check SolidWorks window ===" -ForegroundColor Green
Write-Host ""
