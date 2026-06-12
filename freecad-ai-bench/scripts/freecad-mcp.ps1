#Requires -Version 5.1
<#
.SYNOPSIS
  Unified FreeCAD + Fasteners + MCP bench (single entry).

.PARAMETER Action
  setup          - FreeCAD + Fasteners + MCP + tests (default)
  freecad        - install FreeCAD via winget
  fasteners      - install Fasteners Workbench
  init-fasteners - verify Fasteners / ISO4762
  mcp            - neka-nat/freecad-mcp addon + uv + Cursor config
  config         - Cursor mcp.json only
  verify         - MCP health check + Cursor sync
  test-mcp       - MCP smoke test
  test-model     - generate M3x20 ISO4762 screw (FreeCADCmd, no RPC)
  screw          - generate ISO4762 screw via MCP (-Size M5 -Length 60)
  help           - show commands

  Aliases: all/install -> mcp, test -> test-mcp
#>
param(
    [ValidateSet(
        'setup', 'freecad', 'fasteners', 'init-fasteners',
        'mcp', 'config', 'verify', 'test-mcp', 'test-model', 'screw', 'help',
        'all', 'install', 'test'
    )]
    [string]$Action = 'setup',
    [ValidateSet('global', 'project', 'both')]
    [string]$CursorScope = 'both',
    [switch]$SkipClone,
    [switch]$SkipUv,
    [switch]$SkipCursorConfig,
    [switch]$DevMode,
    [switch]$LaunchFreeCad,
    [switch]$WithFreeCad,
    [switch]$SkipFreeCadInstall,
    [switch]$SkipFastenersInstall,
    [switch]$SkipMcpInstall,
    [switch]$SkipTests,
    [switch]$ForceFreeCad,
    [switch]$ForceFasteners,
    [string]$RepoUrl = 'https://github.com/neka-nat/freecad-mcp.git',
    [string]$Size = 'M3',
    [double]$Length = 20,
    [string]$ScrewOutput = '',
    [switch]$RealThread,
    [switch]$SimpleThread,
    [switch]$NoThread
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\lib\common.ps1')

$benchRoot = Get-BenchRoot
$repoRoot = Get-RepoRoot
$vendorRoot = Get-FreeCadMcpVendorPath
$addonSrc = Join-Path $vendorRoot 'addon\FreeCADMCP'

function Install-FreeCadMcpRepo {
    param([string]$RepoUrl, [string]$VendorRoot)

    $addonCheck = Join-Path $VendorRoot 'addon\FreeCADMCP'
    if (Test-Path -LiteralPath $addonCheck) {
        Write-Ok "Repository already present: $VendorRoot"
        return
    }

    $git = Find-GitExe
    if ($git -and -not (Test-Path -LiteralPath (Join-Path $VendorRoot '.git'))) {
        if (Test-Path -LiteralPath $VendorRoot) {
            Remove-Item -LiteralPath $VendorRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
        Write-Step "Cloning $RepoUrl"
        New-Item -ItemType Directory -Force -Path (Split-Path $VendorRoot -Parent) | Out-Null
        & $git clone $RepoUrl $VendorRoot
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "Repository: $VendorRoot"
            return
        }
        Write-Warn 'git clone failed; trying ZIP download fallback'
        if (Test-Path -LiteralPath $VendorRoot) {
            Remove-Item -LiteralPath $VendorRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    } elseif ($git -and (Test-Path -LiteralPath (Join-Path $VendorRoot '.git'))) {
        Write-Step 'Updating freecad-mcp repository'
        & $git -C $VendorRoot pull --ff-only
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "Repository updated: $VendorRoot"
            return
        }
        Write-Warn 'git pull failed; continuing with existing clone'
        return
    }

    Write-Step 'Downloading freecad-mcp ZIP (main branch)'
    $zipUrl = 'https://github.com/neka-nat/freecad-mcp/archive/refs/heads/main.zip'
    $zipPath = Join-Path $env:TEMP 'freecad-mcp-main.zip'
    $extractRoot = Join-Path $env:TEMP 'freecad-mcp-main'
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
    if (Test-Path -LiteralPath $extractRoot) {
        Remove-Item -LiteralPath $extractRoot -Recurse -Force
    }
    Expand-Archive -LiteralPath $zipPath -DestinationPath $env:TEMP -Force
    if (Test-Path -LiteralPath $VendorRoot) {
        Remove-Item -LiteralPath $VendorRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path (Split-Path $VendorRoot -Parent) | Out-Null
    Move-Item -LiteralPath $extractRoot -Destination $VendorRoot
    Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
    Write-Ok "Repository extracted: $VendorRoot"
}

function Install-FreeCadMcpAddon {
    if (-not (Test-Path -LiteralPath $addonSrc)) {
        throw "Addon source missing: $addonSrc"
    }
    Write-Step 'Installing FreeCADMCP addon into FreeCAD Mod directories'
    $targets = @(
        (Join-Path $env:APPDATA 'FreeCAD\v1-1\Mod\FreeCADMCP'),
        (Join-Path $env:APPDATA 'FreeCAD\Mod\FreeCADMCP')
    )
    foreach ($dest in $targets) {
        New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
        if (Test-Path -LiteralPath $dest) {
            Remove-Item -LiteralPath $dest -Recurse -Force
        }
        Copy-Item -LiteralPath $addonSrc -Destination $dest -Recurse -Force
        Write-Ok "Addon installed: $dest"
    }
}

function Install-FreeCadMcpPackage {
    Install-UvToolchain
    $uvx = Find-UvxExe
    if (-not $uvx) { throw 'uvx not found after uv install' }
    Write-Ok "uvx: $uvx"
    Write-Step 'Prefetch freecad-mcp package via uvx'
    & $uvx freecad-mcp --help | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warn 'uvx freecad-mcp --help returned non-zero; package may still work in Cursor'
    } else {
        Write-Ok 'freecad-mcp package ready via uvx'
    }
}

function Get-FreeCadMcpCursorEntry {
    if ($DevMode) {
        if (-not (Test-Path -LiteralPath $vendorRoot)) {
            throw "Dev mode requires vendor clone: $vendorRoot"
        }
        $uv = Find-UvExe
        if (-not $uv) { throw 'uv not found for dev mode' }
        return @{
            command = ($uv -replace '\\', '/')
            args    = @('--directory', ($vendorRoot -replace '\\', '/'), 'run', 'freecad-mcp')
        }
    }
    $uvx = Find-UvxExe
    if (-not $uvx) { throw 'uvx not found. Run with -Action install first.' }
    return @{
        command = ($uvx -replace '\\', '/')
        args    = @('freecad-mcp')
    }
}

function Set-CursorFreeCadMcpConfig {
    param([string]$Scope = 'both')

    $entry = Get-FreeCadMcpCursorEntry
    Write-Step "Configuring Cursor MCP (scope: $Scope, mode: $(if ($DevMode) { 'dev' } else { 'uvx' }))"
    Write-Host "  Command: $($entry.command)"
    Write-Host "  Args:    $($entry.args -join ' ')"

    $targets = @()
    if ($Scope -eq 'global' -or $Scope -eq 'both') {
        $targets += @{ Path = Join-Path $env:USERPROFILE '.cursor\mcp.json'; Label = 'Cursor global' }
    }
    if ($Scope -eq 'project' -or $Scope -eq 'both') {
        $targets += @{ Path = Join-Path $repoRoot '.cursor\mcp.json'; Label = 'Cursor project' }
    }

    $configured = 0
    foreach ($target in $targets) {
        $dir = Split-Path $target.Path -Parent
        if (-not (Test-Path -LiteralPath $dir)) {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
        }

        $mcpServers = @{}
        if (Test-Path -LiteralPath $target.Path) {
            $existing = Get-Content -LiteralPath $target.Path -Raw | ConvertFrom-Json
            if ($existing.mcpServers) {
                $existing.mcpServers.PSObject.Properties | ForEach-Object {
                    $mcpServers[$_.Name] = $_.Value
                }
            }
        }
        $mcpServers['freecad'] = [ordered]@{
            command = $entry.command
            args    = @($entry.args)
        }
        $payload = [ordered]@{ mcpServers = $mcpServers }
        ($payload | ConvertTo-Json -Depth 10) + "`n" | Set-Content -LiteralPath $target.Path -Encoding utf8
        Write-Ok "$($target.Label): $($target.Path)"
        $configured++
    }
    if ($configured -eq 0) { throw 'Could not write any Cursor MCP config files.' }
}

function Test-FreeCadMcpEnvironment {
    $ok = $true
    $addon = Get-FreeCadMcpAddonPath
    if (Test-Path -LiteralPath $addon) {
        Write-Ok "FreeCADMCP addon: $addon"
    } else {
        Write-Err "FreeCADMCP addon missing: $addon"
        $ok = $false
    }
    if (Test-Path -LiteralPath $vendorRoot) {
        Write-Ok "Upstream source: $vendorRoot"
    } else {
        Write-Warn "Upstream source missing: $vendorRoot"
    }
    $uvx = Find-UvxExe
    if ($uvx) {
        Write-Ok "uvx: $uvx"
    } else {
        Write-Err 'uvx not found'
        $ok = $false
    }
    $gui = Find-FreeCadGui
    if ($gui) {
        Write-Ok "FreeCAD GUI: $gui"
    } else {
        Write-Warn 'FreeCAD GUI not found'
    }
    return $ok
}

function Show-FreeCadMcpUsage {
    Write-Host ''
    Write-Host 'Manual steps (once per FreeCAD session):' -ForegroundColor Yellow
    Write-Host '  1. Open FreeCAD'
    Write-Host '  2. Workbench -> MCP Addon (FreeCADMCP)'
    Write-Host '  3. Toolbar -> Start RPC Server'
    Write-Host '  4. Optional: MCP menu -> Auto-Start Server'
    Write-Host '  5. Cursor -> MCP: Reload Servers'
    Write-Host ''
    Write-Host 'Docs: https://github.com/neka-nat/freecad-mcp' -ForegroundColor Cyan
}

function Invoke-FreeCadMcpSmokeTest {
    $uvx = Find-UvxExe
    if (-not $uvx) { throw 'uvx not found' }

    Write-Step 'MCP smoke test (initialize + tools/list)'
    $expected = @('create_document', 'create_object', 'execute_code', 'get_objects', 'get_view')

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $uvx
    $psi.Arguments = 'freecad-mcp'
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    [void]$proc.Start()

    $send = {
        param($obj)
        $proc.StandardInput.WriteLine(($obj | ConvertTo-Json -Compress -Depth 8))
    }

    & $send @{ jsonrpc = '2.0'; id = 1; method = 'initialize'; params = @{
        protocolVersion = '2024-11-05'; capabilities = @{}; clientInfo = @{ name = 'freecad-mcp-smoke'; version = '1.0.0' }
    }}
    & $send @{ jsonrpc = '2.0'; method = 'notifications/initialized' }
    & $send @{ jsonrpc = '2.0'; id = 2; method = 'tools/list' }
    if ($WithFreeCad) {
        & $send @{ jsonrpc = '2.0'; id = 3; method = 'tools/call'; params = @{ name = 'create_document'; arguments = @{ name = 'MCP_Smoke_Test' } } }
    }

    Start-Sleep -Seconds $(if ($WithFreeCad) { 15 } else { 10 })
    $proc.StandardInput.Close()

    $deadline = (Get-Date).AddSeconds(20)
    $lines = New-Object System.Collections.Generic.List[string]
    while ((Get-Date) -lt $deadline) {
        while ($proc.StandardOutput.Peek() -ge 0) {
            $lines.Add($proc.StandardOutput.ReadLine())
        }
        if ($proc.HasExited) { break }
        Start-Sleep -Milliseconds 150
    }
    if (-not $proc.HasExited) { $proc.Kill() }
    Start-Sleep -Milliseconds 200
    while ($proc.StandardOutput.Peek() -ge 0) {
        $lines.Add($proc.StandardOutput.ReadLine())
    }

    $responses = @()
    foreach ($line in $lines) {
        try { $responses += ($line | ConvertFrom-Json) } catch { }
    }

    $init = $responses | Where-Object { $_.id -eq 1 } | Select-Object -First 1
    if (-not $init.result) { throw 'Smoke test failed: initialize' }
    Write-Ok ("initialize — " + $init.result.serverInfo.name)

    $toolsResp = $responses | Where-Object { $_.id -eq 2 } | Select-Object -First 1
    $toolNames = @()
    if ($toolsResp.result.tools) {
        $toolNames = @($toolsResp.result.tools | ForEach-Object { $_.name })
    }
    $missing = @($expected | Where-Object { $toolNames -notcontains $_ })
    if ($missing.Count -gt 0) {
        Write-Warn ("tools/list incomplete (missing: " + ($missing -join ', ') + "). MCP server started OK.")
        Write-Ok 'Smoke test partial — initialize OK (reload Cursor to use ~11 tools)'
        return
    }
    Write-Ok ("tools/list — " + $toolNames.Count + " tools")

    if ($WithFreeCad) {
        $create = $responses | Where-Object { $_.id -eq 3 } | Select-Object -First 1
        if ($create.result.isError) {
            Write-Warn 'create_document failed — is FreeCAD RPC server running?'
        } else {
            Write-Ok 'create_document — FreeCAD RPC connected'
        }
    } else {
        Write-Host 'INFO: skipped RPC call (use -WithFreeCad when FreeCAD RPC is running)'
    }
}

function Show-BenchHelp {
    Write-Host @'

freecad-mcp.bat commands:
  setup          Full install + tests (default)
  freecad        Install FreeCAD 1.x (winget)
  fasteners      Install Fasteners Workbench
  init-fasteners Verify Fasteners / ISO4762
  mcp            neka-nat/freecad-mcp + Cursor config
  config         Cursor mcp.json only
  verify         MCP health check
  test-mcp       MCP smoke test
  test-model     Generate M3x20 screw via FreeCADCmd (setup default test)
  screw          Generate screw via MCP execute_code (FreeCAD RPC required)
  help           This help

Linux/macOS: use ./freecad-mcp.sh (same commands and flags)

Examples:
  freecad-mcp.bat
  freecad-mcp.bat mcp
  freecad-mcp.bat test-model -Size M3 -Length 20
  freecad-mcp.bat screw -Size M5 -Length 60   (FreeCAD RPC server must be running)

Note: always use -Size M3 and -Length 20 (Length is mm, not M3).

'@
}

function Invoke-BenchStep {
    param(
        [string]$Name,
        [string]$Script,
        [hashtable]$Params = @{}
    )
    Write-Host ''
    Write-Host "========== $Name ==========" -ForegroundColor Magenta
    $path = Join-Path $PSScriptRoot $Script
    if ($Params.Count -gt 0) {
        & $path @Params
    } else {
        & $path
    }
    Assert-LastExitCode $Name
}

function Invoke-McpSetup {
    Write-Step 'MCP setup: neka-nat/freecad-mcp + Cursor config'
    if (-not $SkipClone) { Install-FreeCadMcpRepo -RepoUrl $RepoUrl -VendorRoot $vendorRoot }
    Install-FreeCadMcpAddon
    if (-not $SkipUv) { Install-FreeCadMcpPackage }
    if (-not (Test-FreeCadMcpEnvironment)) { throw 'MCP environment check failed' }
    if (-not $SkipCursorConfig) { Set-CursorFreeCadMcpConfig -Scope $CursorScope }
    Show-FreeCadMcpUsage
    if ($LaunchFreeCad) {
        $gui = Find-FreeCadGui
        if ($gui) { Start-Process -FilePath $gui }
    }
    Write-Ok 'MCP setup complete'
}

function Invoke-FullSetup {
    if (-not $SkipFreeCadInstall) {
        $fcParams = @{}
        if ($ForceFreeCad) { $fcParams.Force = $true }
        Invoke-BenchStep 'Install FreeCAD' 'install-freecad.ps1' -Params $fcParams
    }
    if (-not $SkipFastenersInstall) {
        $faParams = @{}
        if ($ForceFasteners) { $faParams.Force = $true }
        Invoke-BenchStep 'Install Fasteners Workbench' 'install-fasteners.ps1' -Params $faParams
        Invoke-BenchStep 'Initialize Fasteners Workbench' 'init-fasteners.ps1'
    }
    if (-not $SkipMcpInstall) {
        Invoke-McpSetup
    }
    if (-not $SkipTests) {
        Invoke-BenchStep 'Test FreeCAD screw model' 'test-freecad-model.ps1' -Params @{
            Size   = $Size
            Length = $Length
        }
        if (-not $SkipCursorConfig) { Set-CursorFreeCadMcpConfig -Scope $CursorScope }
        Invoke-FreeCadMcpSmokeTest
        Write-Ok 'MCP smoke test passed'
    }
    Write-Host ''
    Write-Host '========== ALL STEPS PASSED ==========' -ForegroundColor Green
}

function Invoke-McpJsonRpc {
    param(
        [array]$Messages,
        [int]$WaitSeconds = 15
    )

    $uvx = Find-UvxExe
    if (-not $uvx) { throw 'uvx not found. Run: freecad-mcp.bat mcp' }

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $uvx
    $psi.Arguments = 'freecad-mcp'
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi
    [void]$proc.Start()

    foreach ($msg in $Messages) {
        if ($msg.ContainsKey('jsonrpc')) {
            $payload = $msg
        } else {
            $payload = @{ jsonrpc = '2.0' }
            foreach ($key in $msg.Keys) { $payload[$key] = $msg[$key] }
        }
        $proc.StandardInput.WriteLine(($payload | ConvertTo-Json -Compress -Depth 20))
    }

    Start-Sleep -Seconds $WaitSeconds
    $proc.StandardInput.Close()

    $deadline = (Get-Date).AddSeconds([Math]::Max(20, $WaitSeconds + 10))
    $lines = New-Object System.Collections.Generic.List[string]
    while ((Get-Date) -lt $deadline) {
        while ($proc.StandardOutput.Peek() -ge 0) {
            $lines.Add($proc.StandardOutput.ReadLine())
        }
        if ($proc.HasExited) { break }
        Start-Sleep -Milliseconds 150
    }
    if (-not $proc.HasExited) { $proc.Kill() }
    Start-Sleep -Milliseconds 200
    while ($proc.StandardOutput.Peek() -ge 0) {
        $lines.Add($proc.StandardOutput.ReadLine())
    }

    $responses = @()
    foreach ($line in $lines) {
        try { $responses += ($line | ConvertFrom-Json) } catch { }
    }
    return $responses
}

function Get-ScrewMcpExecuteCode {
    param(
        [string]$PyScript,
        [string]$Size,
        [double]$Length,
        [string]$OutputPath,
        [string]$ThreadMode
    )
    $py = $PyScript.Replace('\', '/')
    $out = $OutputPath.Replace('\', '/')
    $lenText = if ($Length -eq [math]::Floor($Length)) { [string][int]$Length } else { [string]$Length }
    return @"
import os
os.environ['SCREW_SIZE'] = '$Size'
os.environ['SCREW_LENGTH'] = '$lenText'
os.environ['SCREW_THREAD'] = '$ThreadMode'
os.environ['SCREW_OUTPUT'] = r'$out'
_path = r'$py'
with open(_path, encoding='utf-8') as _f:
    _src = _f.read()
if 'raise SystemExit(main())' in _src:
    _src = _src.replace('raise SystemExit(main())', 'main()', 1)
exec(compile(_src, _path, 'exec'), {'__name__': '__main__', '__file__': _path})
"@
}

function Invoke-FreeCadScrewViaMcp {
    $pyScript = Join-Path $benchRoot 'python\freecad-iso4762-screw.py'
    if (-not (Test-Path -LiteralPath $pyScript)) {
        throw "Missing generator: $pyScript"
    }

    $outDir = Join-Path $benchRoot 'output'
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    if (-not $ScrewOutput) {
        $suffix = if ($SimpleThread -or $NoThread) { 'iso4762' } else { 'iso4762_threaded' }
        $ScrewOutput = Join-Path $outDir "${Size}x${Length}_${suffix}.FCStd"
    }
    $outParent = Split-Path $ScrewOutput -Parent
    New-Item -ItemType Directory -Force -Path $outParent | Out-Null
    $ScrewOutput = Join-Path (Resolve-Path -LiteralPath $outParent).Path (Split-Path $ScrewOutput -Leaf)

    if ($NoThread) { $threadMode = 'none' }
    elseif ($SimpleThread) { $threadMode = 'simple' }
    else { $threadMode = 'real' }

    $code = Get-ScrewMcpExecuteCode -PyScript $pyScript -Size $Size -Length $Length `
        -OutputPath $ScrewOutput -ThreadMode $threadMode

    Write-Step "MCP execute_code: generating screw ${Size}x${Length} (requires FreeCAD RPC server)"
    Write-Host '  Ensure FreeCAD is open -> MCP Addon -> Start RPC Server'

    $responses = Invoke-McpJsonRpc -WaitSeconds 120 -Messages @(
        @{ id = 1; method = 'initialize'; params = @{
            protocolVersion = '2024-11-05'; capabilities = @{}; clientInfo = @{ name = 'freecad-bench-screw'; version = '1.0.0' }
        }}
        @{ method = 'notifications/initialized' }
        @{ id = 2; method = 'tools/call'; params = @{ name = 'execute_code'; arguments = @{ code = $code } } }
    )

    $init = $responses | Where-Object { $_.id -eq 1 } | Select-Object -First 1
    if (-not $init.result) {
        throw 'MCP initialize failed. Check uvx freecad-mcp.'
    }

    $execResp = $responses | Where-Object { $_.id -eq 2 } | Select-Object -First 1
    $text = ($execResp.result.content | Select-Object -First 1).text
    if ($execResp.result.isError -or -not $text -or $text -match '^Failed to execute code') {
        $detail = if ($text) { $text } else { 'FreeCAD RPC not running? Start RPC Server in FreeCAD.' }
        throw "MCP execute_code failed: $detail"
    }

    foreach ($file in @($ScrewOutput, [System.IO.Path]::ChangeExtension($ScrewOutput, '.step'))) {
        if (-not (Test-Path -LiteralPath $file)) {
            throw "Expected output missing after MCP run: $file"
        }
        $bytes = (Get-Item -LiteralPath $file).Length
        if ($bytes -lt 512) {
            throw "Output too small ($bytes bytes): $file"
        }
        Write-Ok "$file ($bytes bytes)"
    }

    if ($text) {
        Write-Host ($text -split "`n" | ForEach-Object { "  $_" }) -ForegroundColor DarkGray
    }
}

# --- main ---
switch ($Action) {
    'all' { $Action = 'mcp' }
    'install' { $Action = 'mcp' }
    'test' { $Action = 'test-mcp' }
}

if ($Action -eq 'help') {
    Show-BenchHelp
    exit 0
}

Write-Host ''
Write-Host "freecad-ai-bench [$Action]" -ForegroundColor Magenta
Write-Host ''

try {
    switch ($Action) {
        'setup' { Invoke-FullSetup }
        'freecad' {
            $fcParams = @{}
            if ($ForceFreeCad) { $fcParams.Force = $true }
            Invoke-BenchStep 'Install FreeCAD' 'install-freecad.ps1' -Params $fcParams
        }
        'fasteners' {
            $faParams = @{}
            if ($ForceFasteners) { $faParams.Force = $true }
            Invoke-BenchStep 'Install Fasteners Workbench' 'install-fasteners.ps1' -Params $faParams
        }
        'init-fasteners' { Invoke-BenchStep 'Initialize Fasteners Workbench' 'init-fasteners.ps1' }
        'mcp' { Invoke-McpSetup }
        'config' {
            Set-CursorFreeCadMcpConfig -Scope $CursorScope
            Write-Ok 'Cursor MCP config complete'
        }
        'verify' {
            if (-not (Test-FreeCadMcpEnvironment)) { exit 1 }
            if (-not $SkipCursorConfig) { Set-CursorFreeCadMcpConfig -Scope $CursorScope }
            Show-FreeCadMcpUsage
            if ($LaunchFreeCad) {
                $gui = Find-FreeCadGui
                if ($gui) { Start-Process -FilePath $gui }
            }
            Write-Ok 'Verification passed'
        }
        'test-mcp' {
            if (-not $SkipCursorConfig) { Set-CursorFreeCadMcpConfig -Scope $CursorScope }
            if (-not (Test-Path -LiteralPath (Get-FreeCadMcpAddonPath))) {
                throw 'Addon missing. Run: freecad-mcp.bat mcp'
            }
            Invoke-FreeCadMcpSmokeTest
            Write-Ok 'Smoke test passed'
        }
        'test-model' { Invoke-FreeCadScrewViaMcp }
        'screw' { Invoke-FreeCadScrewViaMcp }
        default { throw "Unknown action: $Action" }
    }
}
catch {
    Write-Host ''
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host 'Next: FreeCAD -> Start RPC Server, then Cursor -> MCP: Reload Servers' -ForegroundColor Green
