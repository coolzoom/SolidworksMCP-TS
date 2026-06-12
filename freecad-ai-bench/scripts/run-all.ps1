#Requires -Version 5.1
param(
    [switch]$SkipFreeCadInstall,
    [switch]$SkipFastenersInstall,
    [switch]$SkipMcpInstall,
    [switch]$SkipTests,
    [switch]$SkipCursorConfig,
    [ValidateSet('global', 'project', 'both')]
    [string]$CursorScope = 'both',
    [switch]$ForceFreeCad,
    [switch]$ForceFasteners
)

$ErrorActionPreference = 'Stop'
$scripts = Join-Path $PSScriptRoot '.'

function Invoke-Step([string]$Name, [string]$Script, [object[]]$Args = @()) {
    Write-Host ''
    Write-Host "========== $Name ==========" -ForegroundColor Magenta
    & (Join-Path $scripts $Script) @Args
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE"
    }
}

try {
    if (-not $SkipFreeCadInstall) {
        $fcArgs = @()
        if ($ForceFreeCad) { $fcArgs += '-Force' }
        Invoke-Step 'Install FreeCAD' 'install-freecad.ps1' $fcArgs
    }

    if (-not $SkipFastenersInstall) {
        $faArgs = @()
        if ($ForceFasteners) { $faArgs += '-Force' }
        Invoke-Step 'Install Fasteners Workbench' 'install-fasteners.ps1' $faArgs
        Invoke-Step 'Initialize Fasteners Workbench' 'init-fasteners.ps1'
    }

    if (-not $SkipMcpInstall) {
        $mcpArgs = @('-CursorScope', $CursorScope)
        if ($SkipCursorConfig) { $mcpArgs += '-SkipCursorConfig' }
        Invoke-Step 'Install FreeCAD MCP' 'install-mcp.ps1' $mcpArgs
    }

    if (-not $SkipTests) {
        Invoke-Step 'Test FreeCAD screw model' 'test-freecad-model.ps1'
        Invoke-Step 'Test FreeCAD MCP server' 'test-mcp.ps1'
    }

    Write-Host ''
    Write-Host '========== ALL STEPS PASSED ==========' -ForegroundColor Green
    exit 0
}
catch {
    Write-Host ''
    Write-Host "========== FAILED: $($_.Exception.Message) ==========" -ForegroundColor Red
    exit 1
}
