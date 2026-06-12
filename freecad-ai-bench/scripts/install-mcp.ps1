#Requires -Version 5.1
param(
    [switch]$SkipNpmInstall,
    [switch]$SkipCursorConfig,
    [ValidateSet('global', 'project', 'both')]
    [string]$CursorScope = 'both'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')

$benchRoot = Get-BenchRoot
$repoRoot = Get-RepoRoot
Write-Step "Installing FreeCAD MCP dependencies"

$node = Find-NodeExe
$npm = Find-NpmCmd
if (-not $node -or -not $npm) {
    Write-Err 'Node.js/npm not found. Install Node.js 20+ and rerun.'
    exit 1
}
Write-Ok "Node: $node"

$mcpEntry = Join-Path $benchRoot 'mcp-server\index.mjs'
if (-not (Test-Path -LiteralPath $mcpEntry)) {
    Write-Err "Missing FreeCAD MCP server: $mcpEntry"
    exit 1
}

Push-Location $repoRoot
try {
    if (-not $SkipNpmInstall) {
        Write-Step 'Running npm install (MCP SDK from repo root)'
        & $npm install
        Assert-LastExitCode 'npm install'
        Write-Ok 'npm install complete'
    }

    $mcpSdk = Join-Path $repoRoot 'node_modules\@modelcontextprotocol\sdk'
    if (-not (Test-Path -LiteralPath $mcpSdk)) {
        Write-Err "Missing @modelcontextprotocol/sdk at $mcpSdk"
        exit 1
    }
    Write-Ok "FreeCAD MCP server ready: $mcpEntry"
}
finally {
    Pop-Location
}

if (-not $SkipCursorConfig) {
    Write-Step 'Configuring Cursor MCP for FreeCAD'
    & (Join-Path $PSScriptRoot 'configure-cursor-mcp.ps1') -CursorScope $CursorScope
    Assert-LastExitCode 'configure-cursor-mcp'
} else {
    Write-Warn 'Skipped Cursor MCP config (-SkipCursorConfig)'
}

Write-Ok 'FreeCAD MCP install complete'
