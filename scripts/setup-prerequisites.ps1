#Requires -Version 5.1
<#
.SYNOPSIS
  Check / install Node.js, Python, VS Build Tools, and compile winax for SolidWorks MCP.

.PARAMETER InstallMissing
  Attempt to install missing prerequisites via winget (Node.js, Python, VS Build Tools).

.PARAMETER BuildWinax
  Compile the winax native module after prerequisites are satisfied.

.PARAMETER ProjectDir
  Project root directory (default: parent of scripts/).

.PARAMETER MinNodeMajor
  Minimum Node.js major version (default: 20).
#>

param(
    [switch]$InstallMissing,
    [switch]$BuildWinax,
    [switch]$CheckOnly,
    [string]$ProjectDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [int]$MinNodeMajor = 20,
    [int]$MaxNodeMajorForWinax = 22
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) { Write-Host "[INFO] $Message" }
function Write-Ok([string]$Message)   { Write-Host "[OK]   $Message" -ForegroundColor Green }
function Write-Warn([string]$Message){ Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Err([string]$Message)  { Write-Host "[ERR]  $Message" -ForegroundColor Red }

function Refresh-Path {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    if ($machine -and $user) { $env:Path = "$machine;$user" }
    elseif ($machine) { $env:Path = $machine }
    elseif ($user) { $env:Path = $user }
}

function Test-Winget {
    return [bool](Get-Command winget -ErrorAction SilentlyContinue)
}

function Install-WingetPackage([string]$Id, [string]$Label) {
    if (-not (Test-Winget)) {
        Write-Err "winget not found. Install $Label manually: https://winget.run/pkg/$($Id -replace '\.','/')"
        return $false
    }
    Write-Step "Installing $Label via winget ($Id)..."
    Write-Warn "This may take several minutes and require administrator approval."
    $proc = Start-Process -FilePath 'winget' -ArgumentList @(
        'install', '--id', $Id,
        '--accept-package-agreements', '--accept-source-agreements',
        '--disable-interactivity'
    ) -Wait -PassThru -NoNewWindow
    if ($proc.ExitCode -ne 0) {
        Write-Err "winget install failed for $Label (exit $($proc.ExitCode))"
        return $false
    }
    Refresh-Path
    Write-Ok "$Label installed"
    return $true
}

function Find-NodeExe {
    Refresh-Path
    $candidates = @(
        (Join-Path ${env:ProgramFiles} 'nodejs\node.exe'),
        (Join-Path ${env:LOCALAPPDATA} 'Programs\nodejs\node.exe')
    )
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    try {
        $reg = Get-ItemProperty 'HKLM:\SOFTWARE\Node.js' -ErrorAction Stop
        if ($reg.InstallPath) {
            $p = Join-Path $reg.InstallPath.TrimEnd('\') 'node.exe'
            if (Test-Path $p) { return $p }
        }
    } catch { }

    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    return $null
}

function Get-NodeVersion([string]$NodeExe) {
    $v = & $NodeExe --version 2>$null
    if ($v -match '^v?(\d+)') { return [int]$Matches[1] }
    return 0
}

function Find-Node20Exe {
    Refresh-Path
    $candidates = @(
        (Join-Path ${env:ProgramFiles} 'nodejs\node.exe'),
        'C:\Program Files\nodejs\node.exe'
    )
    # Side-by-side Node 20 from winget OpenJS.NodeJS.20
    $local = Join-Path ${env:LOCALAPPDATA} 'Programs\nodejs'
    if (Test-Path $local) {
        Get-ChildItem $local -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $candidates += (Join-Path $_.FullName 'node.exe')
        }
    }
    foreach ($c in $candidates | Select-Object -Unique) {
        if ((Test-Path $c) -and (Get-NodeVersion $c) -eq 20) { return $c }
    }
    return $null
}

function Ensure-Node {
    $node = Find-NodeExe
    if ($node) {
        $major = Get-NodeVersion $node
        if ($major -ge $MinNodeMajor) {
            $ver = & $node --version
            $nodeDir = Split-Path $node -Parent
            if ($env:Path -notlike "*$nodeDir*") {
                $env:Path = "$nodeDir;$env:Path"
                Write-Warn "Node.js added to PATH for this session: $nodeDir"
            }
            Write-Ok "Node.js $ver"
            if ($BuildWinax -and $major -gt $MaxNodeMajorForWinax) {
                Write-Warn "Node.js v$major is too new for winax (use v20-v$MaxNodeMajorForWinax)"
                $node20 = Find-Node20Exe
                if ($node20) {
                    $env:Path = "$(Split-Path $node20 -Parent);$env:Path"
                    Write-Ok "Using Node.js 20 for winax build: $(& $node20 --version)"
                } elseif ($InstallMissing) {
                    Write-Step "Installing Node.js 20 LTS for winax compatibility..."
                    if (Install-WingetPackage 'OpenJS.NodeJS.20' 'Node.js 20') {
                        $node20 = Find-Node20Exe
                        if ($node20) {
                            $env:Path = "$(Split-Path $node20 -Parent);$env:Path"
                            Write-Ok "Node.js 20 ready for winax: $(& $node20 --version)"
                        }
                    }
                } else {
                    Write-Err "winax requires Node.js 20-22. Install: winget install OpenJS.NodeJS.20"
                    return $false
                }
            }
            return $true
        }
        Write-Err "Node.js $MinNodeMajor+ required (found v$major)"
    } else {
        Write-Err "Node.js not found"
    }

    if ($InstallMissing) {
        $pkg = if ($BuildWinax) { 'OpenJS.NodeJS.20' } else { 'OpenJS.NodeJS.LTS' }
        $label = if ($BuildWinax) { 'Node.js 20 (winax compatible)' } else { 'Node.js LTS' }
        if (Install-WingetPackage $pkg $label) {
            $node = Find-NodeExe
            if ($node -and (Get-NodeVersion $node) -ge $MinNodeMajor) {
                $env:Path = "$(Split-Path $node -Parent);$env:Path"
                Write-Ok "Node.js $(& $node --version)"
                return $true
            }
        }
    }

    Write-Err "Install Node.js $MinNodeMajor+ from https://nodejs.org/ or run: install.bat --install-deps"
    return $false
}

function Find-PythonExe {
    Refresh-Path
    $candidates = @()

    # py launcher (preferred on Windows)
    $py = Get-Command py -ErrorAction SilentlyContinue
    if ($py) {
        foreach ($ver in @('-3.12', '-3.11', '-3')) {
            try {
                $out = & py $ver -c "import sys; print(sys.executable)" 2>$null
                if ($out -and (Test-Path $out.Trim())) { return $out.Trim() }
            } catch { }
        }
    }

    foreach ($name in @('python', 'python3')) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) { $candidates += $cmd.Source }
    }

    $searchRoots = @(
        (Join-Path ${env:LOCALAPPDATA} 'Programs\Python'),
        (Join-Path ${env:ProgramFiles} 'Python312'),
        (Join-Path ${env:ProgramFiles} 'Python311'),
        (Join-Path ${env:ProgramFiles} 'Python310')
    )
    foreach ($root in $searchRoots) {
        if (Test-Path $root) {
            Get-ChildItem -Path $root -Filter 'python.exe' -Recurse -ErrorAction SilentlyContinue |
                ForEach-Object { $candidates += $_.FullName }
        }
    }

    foreach ($p in $candidates | Select-Object -Unique) {
        try {
            $ver = & $p --version 2>&1
            if ($ver -match 'Python 3\.(\d+)') {
                if ([int]$Matches[1] -ge 8) { return $p }
            }
        } catch { }
    }
    return $null
}

function Ensure-Python {
    $python = Find-PythonExe
    if ($python) {
        $env:PYTHON = $python
        $env:npm_config_python = $python
        $ver = & $python --version 2>&1
        Write-Ok "Python $ver ($python)"
        return $true
    }

    Write-Err "Python 3.8+ not found (required by node-gyp to build winax)"

    if ($InstallMissing) {
        if (Install-WingetPackage 'Python.Python.3.12' 'Python 3.12') {
            $python = Find-PythonExe
            if ($python) {
                $env:PYTHON = $python
                $env:npm_config_python = $python
                Write-Ok "Python $(& $python --version 2>&1)"
                return $true
            }
        }
    }

    Write-Err "Install Python from https://www.python.org/downloads/ (check 'Add to PATH')"
    Write-Err "Or run: install.bat --install-deps"
    return $false
}

function Test-VSBuildTools {
    Refresh-Path
    if (Get-Command cl -ErrorAction SilentlyContinue) { return $true }
    if (Get-Command msbuild -ErrorAction SilentlyContinue) { return $true }

    $vswhere = @(
        (Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'),
        (Join-Path ${env:ProgramFiles} 'Microsoft Visual Studio\Installer\vswhere.exe')
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if ($vswhere) {
        $installPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
        if ($installPath -and (Test-Path $installPath)) {
            # Load VS dev environment for current session
            $vcvars = Join-Path $installPath 'VC\Auxiliary\Build\vcvars64.bat'
            if (Test-Path $vcvars) {
                $env:GYP_MSVS_VERSION = '2022'
                Write-Ok "Visual Studio Build Tools found: $installPath"
                return $true
            }
        }
    }

    return $false
}

function Ensure-VSBuildTools {
    if (Test-VSBuildTools) {
        Write-Ok "Visual Studio C++ Build Tools available"
        return $true
    }

    Write-Err "Visual Studio 2022 C++ Build Tools not found (required to compile winax)"

    if ($InstallMissing) {
        Write-Step "Installing VS 2022 Build Tools (C++ workload) via winget..."
        Write-Warn "Download is large (~2 GB). Administrator approval may be required."
        if (-not (Test-Winget)) {
            Write-Err "winget not available"
            return $false
        }
        $override = '--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended'
        $proc = Start-Process -FilePath 'winget' -ArgumentList @(
            'install', '--id', 'Microsoft.VisualStudio.2022.BuildTools',
            '--accept-package-agreements', '--accept-source-agreements',
            '--disable-interactivity',
            '--override', $override
        ) -Wait -PassThru -NoNewWindow
        Refresh-Path
        if ($proc.ExitCode -eq 0 -and (Test-VSBuildTools)) {
            Write-Ok "Visual Studio Build Tools installed"
            return $true
        }
        Write-Err "VS Build Tools install failed or incomplete (exit $($proc.ExitCode))"
    }

    Write-Err "Install manually: https://visualstudio.microsoft.com/visual-cpp-build-tools/"
    Write-Err "Select workload: 'Desktop development with C++'"
    return $false
}

function Test-WinaxPackagePresent {
    $winaxDir = Join-Path $ProjectDir 'node_modules\winax'
    $nativeMod = Join-Path $winaxDir 'build\Release\node_activex.node'
    return (Test-Path $nativeMod)
}

function Test-WinaxLoaded([string]$NodeExe) {
    if (-not (Test-WinaxPackagePresent)) {
        return $false
    }

    Push-Location $ProjectDir
    try {
        $null = cmd /c "`"$NodeExe`" -e `"try{require('winax');process.exit(0)}catch(e){process.exit(1)}`" 2>nul"
        return $LASTEXITCODE -eq 0
    } finally {
        Pop-Location
    }
}

function Build-WinaxModule {
    param([string]$NodeExe)

    Write-Step "Building winax native module..."
    Push-Location $ProjectDir

    $env:GYP_MSVS_VERSION = '2022'
    if (-not $env:PYTHON) {
        $py = Find-PythonExe
        if ($py) {
            $env:PYTHON = $py
            $env:npm_config_python = $py
        }
    }

    $npm = Join-Path (Split-Path $NodeExe -Parent) 'npm.cmd'
    if (-not (Test-Path $npm)) { $npm = 'npm' }

    Write-Step "Running: npm install winax@3.4.2 --save-optional --foreground-scripts"
    & $npm install winax@3.4.2 --save-optional --foreground-scripts
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "winax@3.4.2 build failed, retrying with default version..."
        & $npm install winax --save-optional --foreground-scripts
        if ($LASTEXITCODE -ne 0) {
            Pop-Location
            return $false
        }
    }

    if (-not (Test-WinaxPackagePresent)) {
        Write-Err "winax compile finished but node_activex.node was not produced"
        Pop-Location
        return $false
    }

    if (Test-WinaxLoaded $NodeExe) {
        Write-Ok "winax native module built and loaded successfully"
        Pop-Location
        return $true
    }

    Write-Warn "winax binary exists but load test failed with $(& $NodeExe --version)"
    Write-Warn "Ensure MCP runs with the same Node version that compiled winax"
    Pop-Location
    return (Test-WinaxPackagePresent)
}

# ── Main ─────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "=== Prerequisites Setup ===" -ForegroundColor Cyan
Write-Host ""

$ok = $true

if (-not (Ensure-Node)) { $ok = $false }

if ($CheckOnly -or $BuildWinax) {
    if (-not (Ensure-Python)) { $ok = $false }
    if (-not (Ensure-VSBuildTools)) { $ok = $false }
}

if (-not $ok) {
    if ($InstallMissing) {
        Write-Err "Some prerequisites are still missing after install attempt."
    }
    exit 1
}

if ($BuildWinax) {
    $node = Find-Node20Exe
    if (-not $node) {
        $fallback = Find-NodeExe
        if ($fallback -and (Get-NodeVersion $fallback) -le $MaxNodeMajorForWinax) {
            $node = $fallback
        }
    }
    if (-not $node) {
        Write-Err "Cannot build winax: Node.js 20-22 required (Node 24+ is incompatible)"
        Write-Err "Install: winget install OpenJS.NodeJS.20"
        exit 1
    }
    $env:Path = "$(Split-Path $node -Parent);$env:Path"
    Write-Ok "Building winax with $(& $node --version)"
    if (Test-WinaxLoaded $node) {
        Write-Ok "winax already built and loaded — skipping rebuild"
        exit 0
    }
    if (-not (Test-WinaxPackagePresent)) {
        Write-Step "winax not installed yet — compiling native module..."
    }
    if (Build-WinaxModule $node) { exit 0 }
    exit 1
}

if ($CheckOnly) {
    Write-Ok "All prerequisite checks passed"
    exit 0
}

exit 0
