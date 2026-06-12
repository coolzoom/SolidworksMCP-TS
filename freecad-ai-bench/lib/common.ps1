# Shared helpers for freecad-ai-bench

function Get-BenchRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

function Get-RepoRoot {
    return (Resolve-Path (Join-Path (Get-BenchRoot) '..')).Path
}

function Write-Step([string]$Message) { Write-Host "[STEP] $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message)   { Write-Host "[ OK ] $Message" -ForegroundColor Green }
function Write-Warn([string]$Message){ Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Err([string]$Message) { Write-Host "[FAIL] $Message" -ForegroundColor Red }

function Test-WingetAvailable {
    return [bool](Get-Command winget -ErrorAction SilentlyContinue)
}

function Refresh-PathEnv {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    if ($machine -and $user) { $env:Path = "$machine;$user" }
    elseif ($machine) { $env:Path = $machine }
    elseif ($user) { $env:Path = $user }
}

function Find-FreeCadCmd {
    Refresh-PathEnv
    $patterns = @(
        "$env:LOCALAPPDATA\Programs\FreeCAD *\bin\freecadcmd.exe",
        "$env:LOCALAPPDATA\Programs\FreeCAD *\bin\FreeCADCmd.exe",
        "$env:ProgramFiles\FreeCAD *\bin\FreeCADCmd.exe",
        "${env:ProgramFiles(x86)}\FreeCAD *\bin\FreeCADCmd.exe"
    )
    foreach ($pattern in $patterns) {
        $match = Get-Item $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($match) { return $match.FullName }
    }
    return $null
}

function Find-FreeCadGui {
    $cmd = Find-FreeCadCmd
    if (-not $cmd) { return $null }
    $bin = Split-Path $cmd -Parent
    foreach ($name in @('freecad.exe', 'FreeCAD.exe')) {
        $gui = Join-Path $bin $name
        if (Test-Path -LiteralPath $gui) { return $gui }
    }
    return $null
}

function Find-NodeExe {
    Refresh-PathEnv
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($candidate in @(
        (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe')
    )) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    return $null
}

function Find-NpmCmd {
    Refresh-PathEnv
    $cmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $node = Find-NodeExe
    if (-not $node) { return $null }
    $npm = Join-Path (Split-Path $node -Parent) 'npm.cmd'
    if (Test-Path -LiteralPath $npm) { return $npm }
    return $null
}

function Assert-LastExitCode([string]$StepName) {
    if ($LASTEXITCODE -ne 0) {
        throw "$StepName failed with exit code $LASTEXITCODE"
    }
}

function Get-FastenersModPath {
    return Join-Path $env:APPDATA 'FreeCAD\v1-1\Mod\Fasteners'
}

function Get-FreeCadModRoots {
    $roots = @(
        (Join-Path $env:APPDATA 'FreeCAD\v1-1\Mod'),
        (Join-Path $env:APPDATA 'FreeCAD\Mod')
    )
    return $roots | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -Unique
}

function Get-FreeCadMcpAddonPath {
    $preferred = Join-Path $env:APPDATA 'FreeCAD\v1-1\Mod\FreeCADMCP'
    if (Test-Path -LiteralPath $preferred) { return $preferred }
    $legacy = Join-Path $env:APPDATA 'FreeCAD\Mod\FreeCADMCP'
    if (Test-Path -LiteralPath $legacy) { return $legacy }
    return $preferred
}

function Get-FreeCadMcpVendorPath {
    return (Join-Path (Get-BenchRoot) 'vendor\freecad-mcp')
}

function Find-GitExe {
    Refresh-PathEnv
    $cmd = Get-Command git -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($candidate in @(
        (Join-Path $env:ProgramFiles 'Git\cmd\git.exe'),
        (Join-Path $env:ProgramFiles 'Git\bin\git.exe')
    )) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    return $null
}

function Find-UvxExe {
    Refresh-PathEnv
    $cmd = Get-Command uvx -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    foreach ($candidate in @(
        (Join-Path $env:USERPROFILE '.local\bin\uvx.exe'),
        (Join-Path $env:USERPROFILE '.cargo\bin\uvx.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\uv\uvx.exe')
    )) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }

    $pythonScripts = Join-Path $env:APPDATA 'Python\Python311\Scripts\uvx.exe'
    if (Test-Path -LiteralPath $pythonScripts) { return $pythonScripts }

    return $null
}

function Find-UvExe {
    Refresh-PathEnv
    $cmd = Get-Command uv -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    foreach ($candidate in @(
        (Join-Path $env:USERPROFILE '.local\bin\uv.exe'),
        (Join-Path $env:USERPROFILE '.cargo\bin\uv.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\uv\uv.exe')
    )) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    return $null
}

function Install-UvToolchain {
    if (Find-UvxExe) {
        Write-Ok 'uvx already available'
        return
    }

    Write-Step 'Installing uv (provides uvx for freecad-mcp)'
    if (Test-WingetAvailable) {
        & winget install --id astral-sh.uv -e --accept-source-agreements --accept-package-agreements
        Refresh-PathEnv
        if (Find-UvxExe) {
            Write-Ok 'uv installed via winget'
            return
        }
    }

    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($python) {
        & $python.Source -m pip install --upgrade uv
        Refresh-PathEnv
        if (Find-UvxExe) {
            Write-Ok 'uv installed via pip'
            return
        }
    }

    throw 'Could not install uv/uvx. Install manually: winget install astral-sh.uv'
}
