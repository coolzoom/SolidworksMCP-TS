#Requires -Version 5.1
param(
    [switch]$SkipBuild,
    [switch]$ConfigureCursor,
    [switch]$SkipNpmInstall
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')

$repoRoot = Get-RepoRoot
Write-Step "Installing SolidWorks MCP in: $repoRoot"

$node = Find-NodeExe
$npm = Find-NpmCmd
if (-not $node -or -not $npm) {
    Write-Err 'Node.js/npm not found. Install Node.js 20+ and rerun.'
    exit 1
}
Write-Ok "Node: $node"

Push-Location $repoRoot
try {
    if (-not $SkipNpmInstall) {
        Write-Step 'Running npm install'
        & $npm install
        Assert-LastExitCode 'npm install'
        Write-Ok 'npm install complete'
    }

    if (-not $SkipBuild) {
        Write-Step 'Running npm run build'
        & $npm run build
        Assert-LastExitCode 'npm run build'
        Write-Ok 'TypeScript build complete'
    }

    $distIndex = Join-Path $repoRoot 'dist\index.js'
    if (-not (Test-Path -LiteralPath $distIndex)) {
        Write-Err "Missing build output: $distIndex"
        exit 1
    }

    if ($ConfigureCursor) {
        Write-Step 'Configuring Cursor MCP entry'
        & $node (Join-Path $repoRoot 'scripts\configure-mcp.mjs') --client cursor --project-dir $repoRoot
        Assert-LastExitCode 'configure-mcp'
        Write-Ok 'Cursor MCP configuration updated'
    } else {
        Write-Warn 'Skipped Cursor MCP config (pass -ConfigureCursor to install-mcp.ps1)'
    }
}
finally {
    Pop-Location
}

Write-Ok 'MCP install complete'
