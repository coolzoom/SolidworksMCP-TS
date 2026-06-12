#Requires -Version 5.1
param(
    [ValidateSet('global', 'project', 'both')]
    [string]$CursorScope = 'both'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')

$benchRoot = Get-BenchRoot
$repoRoot = Get-RepoRoot
$node = Find-NodeExe
if (-not $node) {
    Write-Err 'Node.js not found. Install Node.js 20+ first.'
    exit 1
}

$mcpEntry = Join-Path $benchRoot 'mcp-server\index.mjs'
if (-not (Test-Path -LiteralPath $mcpEntry)) {
    Write-Err "FreeCAD MCP server missing: $mcpEntry"
    exit 1
}

$mcpSdk = Join-Path $repoRoot 'node_modules\@modelcontextprotocol\sdk'
if (-not (Test-Path -LiteralPath $mcpSdk)) {
    Write-Err 'MCP SDK not installed. Run install-mcp.bat first (npm install in repo root).'
    exit 1
}

Write-Step "Configuring Cursor for FreeCAD MCP (scope: $CursorScope)"
Write-Host "  Bench: $benchRoot"

& $node (Join-Path $benchRoot 'scripts\configure-freecad-mcp.mjs') --cursor-scope $CursorScope
Assert-LastExitCode 'configure-freecad-mcp'

$globalConfig = Join-Path $env:USERPROFILE '.cursor\mcp.json'
$projectConfig = Join-Path $repoRoot '.cursor\mcp.json'

foreach ($path in @($globalConfig, $projectConfig)) {
    if (-not (Test-Path -LiteralPath $path)) { continue }
    try {
        $json = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
        if ($json.mcpServers.freecad) {
            Write-Ok "Verified freecad entry in $path"
        } else {
            Write-Warn "freecad entry missing in $path"
        }
    } catch {
        Write-Warn "Could not verify $path : $($_.Exception.Message)"
    }
}

Write-Ok 'FreeCAD Cursor MCP configuration complete'
Write-Host ''
Write-Host 'Next: restart Cursor or use Command Palette -> MCP: Reload Servers'
