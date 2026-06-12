#Requires -Version 5.1
param(
    [switch]$CreateScrew
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')

$benchRoot = Get-BenchRoot
$repoRoot = Get-RepoRoot
$node = Find-NodeExe
if (-not $node) {
    Write-Err 'Node.js not found'
    exit 1
}

$mcpEntry = Join-Path $benchRoot 'mcp-server\index.mjs'
if (-not (Test-Path -LiteralPath $mcpEntry)) {
    Write-Err "FreeCAD MCP server missing: $mcpEntry. Run install-mcp.bat first."
    exit 1
}

$mcpSdk = Join-Path $repoRoot 'node_modules\@modelcontextprotocol\sdk'
if (-not (Test-Path -LiteralPath $mcpSdk)) {
    Write-Err 'MCP SDK missing. Run install-mcp.bat first.'
    exit 1
}

Write-Step 'Running FreeCAD MCP smoke test'
if ($CreateScrew) {
    Write-Host '  (includes create_hex_socket_screw tool call)'
}

Push-Location $repoRoot
try {
    $args = @((Join-Path $benchRoot 'scripts\test-freecad-mcp.mjs'))
    if ($CreateScrew) { $args += '--create-screw' }
    & $node @args
    Assert-LastExitCode 'FreeCAD MCP smoke test'
}
finally {
    Pop-Location
}

Write-Ok 'FreeCAD MCP smoke test passed'
