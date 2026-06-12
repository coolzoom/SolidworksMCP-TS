#Requires -Version 5.1
param(
    [switch]$RealSolidWorks
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')

$repoRoot = Get-RepoRoot
$node = Find-NodeExe
if (-not $node) {
    Write-Err 'Node.js not found'
    exit 1
}

$distIndex = Join-Path $repoRoot 'dist\index.js'
if (-not (Test-Path -LiteralPath $distIndex)) {
    Write-Err "MCP not built: $distIndex. Run install-mcp.bat first."
    exit 1
}

$mode = if ($RealSolidWorks) { 'real SolidWorks' } else { 'mock adapter' }
Write-Step "Running MCP smoke test ($mode)"

Push-Location $repoRoot
try {
    $args = @((Join-Path $repoRoot 'scripts\test-mcp-smoke.mjs'))
    if ($RealSolidWorks) { $args += '--real' }
    & $node @args
    Assert-LastExitCode 'MCP smoke test'
}
finally {
    Pop-Location
}

Write-Ok 'MCP smoke test passed'
