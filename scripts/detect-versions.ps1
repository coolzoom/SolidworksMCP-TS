#Requires -Version 5.1
<#
  Detect and initialize runtime versions for SolidWorks MCP install.
  Writes scripts\.install-versions.bat for install.bat to consume.

  Usage:
    powershell -File scripts/detect-versions.ps1 -ProjectDir . -UpdateDotEnv
#>
param(
    [string]$ProjectDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [switch]$UpdateDotEnv,
    [switch]$Production
)

$ErrorActionPreference = 'Continue'

function Refresh-PathEnv {
    $m = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $u = [Environment]::GetEnvironmentVariable('Path', 'User')
    if ($m -and $u) { $script:PathEnv = "$m;$u" }
    elseif ($m) { $script:PathEnv = $m }
    elseif ($u) { $script:PathEnv = $u }
    else { $script:PathEnv = $env:Path }
    $env:Path = $script:PathEnv
}

function Get-NodeMajor([string]$Exe) {
    $v = & $Exe --version 2>$null
    if ($v -match '^v?(\d+)') { return [int]$Matches[1] }
    return 0
}

function Find-AllNodeExes {
    Refresh-PathEnv
    $found = @{}
    $roots = @(
        (Join-Path $env:ProgramFiles 'nodejs'),
        (Join-Path $env:LOCALAPPDATA 'Programs\nodejs')
    )
    foreach ($root in $roots) {
        if (-not (Test-Path $root)) { continue }
        $exe = Join-Path $root 'node.exe'
        if (Test-Path $exe) { $found[$exe] = Get-NodeMajor $exe }
        Get-ChildItem $root -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $e = Join-Path $_.FullName 'node.exe'
            if (Test-Path $e) { $found[$e] = Get-NodeMajor $e }
        }
    }
    try {
        $reg = Get-ItemProperty 'HKLM:\SOFTWARE\Node.js' -ErrorAction Stop
        if ($reg.InstallPath) {
            $e = Join-Path $reg.InstallPath.TrimEnd('\') 'node.exe'
            if (Test-Path $e) { $found[$e] = Get-NodeMajor $e }
        }
    } catch { }
    return $found
}

function Find-Python {
    Refresh-PathEnv
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
        if ($cmd -and (Test-Path $cmd.Source)) { return $cmd.Source }
    }
    $roots = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Python'),
        (Join-Path $env:ProgramFiles 'Python312'),
        (Join-Path $env:ProgramFiles 'Python311')
    )
    foreach ($root in $roots) {
        if (-not (Test-Path $root)) { continue }
        $hit = Get-ChildItem $root -Filter 'python.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($hit) { return $hit.FullName }
    }
    return ''
}

function Sw-YearFromApiMajor([int]$major) {
    if ($major -ge 19 -and $major -le 40) { return (1992 + $major).ToString() }
    return ''
}

function Detect-SolidWorks {
    $result = @{
        Path = 'C:/Program Files/SOLIDWORKS Corp/SOLIDWORKS'
        Version = '2024'
        ApiMajor = ''
        ProgId = 'SldWorks.Application'
        Template = ''
    }

    $installCandidates = @(
        (Join-Path $env:ProgramFiles 'SOLIDWORKS Corp\SOLIDWORKS'),
        (Join-Path ${env:ProgramFiles(x86)} 'SOLIDWORKS Corp\SOLIDWORKS')
    )
    foreach ($dir in $installCandidates) {
        if (Test-Path (Join-Path $dir 'SLDWORKS.exe')) {
            $result.Path = ($dir -replace '\\', '/')
            break
        }
    }

    # Detect running / installed COM version (e.g. .31 = SW 2023)
    $apiMajors = 33..29 | ForEach-Object { $_ }
    foreach ($m in $apiMajors) {
        $progId = "SldWorks.Application.$m"
        try {
            $type = [Type]::GetTypeFromProgID($progId)
            if (-not $type) { continue }
            $result.ProgId = $progId
            $result.ApiMajor = "$m"
            $year = Sw-YearFromApiMajor $m
            if ($year) { $result.Version = $year }
            break
        } catch { }
    }

    # Template path hints install year
    $templates = Get-ChildItem 'C:\ProgramData\SolidWorks' -Filter 'Part.prtdot' -Recurse -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($templates) {
        $result.Template = $templates.FullName
        if ($templates.FullName -match 'SOLIDWORKS\s+(\d{4})') {
            $result.Version = $Matches[1]
        }
    }

    return $result
}

Refresh-PathEnv

$nodes = Find-AllNodeExes
$nodeDefault = ''
$nodeWinax = ''
$best = $nodes.GetEnumerator() | Sort-Object { if ($_.Value -eq 20) { 0 } elseif ($_.Value -le 22) { 1 } else { 2 } }, Value -Descending | Select-Object -First 1
if ($best) {
    $nodeDefault = $best.Key
    $winaxCandidate = $nodes.GetEnumerator() | Where-Object { $_.Value -ge 20 -and $_.Value -le 22 } |
        Sort-Object { if ($_.Value -eq 20) { 0 } else { 1 } } | Select-Object -First 1
    if ($winaxCandidate) { $nodeWinax = $winaxCandidate.Key }
}

$python = Find-Python
$sw = Detect-SolidWorks

$nodeDefaultVer = if ($nodeDefault) { & $nodeDefault --version 2>$null } else { '' }
$nodeWinaxVer = if ($nodeWinax) { & $nodeWinax --version 2>$null } else { '' }
$pythonVer = if ($python) { & $python --version 2>&1 } else { '' }

$batPath = Join-Path $PSScriptRoot '.install-versions.bat'
$lines = @(
    '@echo off',
    'REM Auto-generated by scripts/detect-versions.ps1 — do not edit',
    "set `"NODE_DEFAULT_EXE=$nodeDefault`"",
    "set `"NODE_WINAX_EXE=$nodeWinax`"",
    "set `"NODE_DEFAULT_VERSION=$nodeDefaultVer`"",
    "set `"NODE_WINAX_VERSION=$nodeWinaxVer`"",
    "set `"PYTHON_EXE=$python`"",
    "set `"PYTHON_VERSION=$pythonVer`"",
    "set `"SW_PATH=$($sw.Path)`"",
    "set `"SW_VERSION=$($sw.Version)`"",
    "set `"SW_API_MAJOR=$($sw.ApiMajor)`"",
    "set `"SW_PROG_ID=$($sw.ProgId)`"",
    "set `"SW_TEMPLATE=$($sw.Template)`"",
    "set `"WINAX_VERSION=3.4.2`"",
    'exit /b 0'
)
$lines | Set-Content -Path $batPath -Encoding ASCII

if ($UpdateDotEnv) {
    $envFile = Join-Path $ProjectDir '.env'
    $content = @{}
    if (Test-Path $envFile) {
        Get-Content $envFile | ForEach-Object {
            if ($_ -match '^\s*([^#=]+)=(.*)$') {
                $content[$Matches[1].Trim()] = $Matches[2].Trim()
            }
        }
    } else {
        $example = Join-Path $ProjectDir '.env.example'
        if (Test-Path $example) {
            Get-Content $example | ForEach-Object {
                if ($_ -match '^\s*([^#=]+)=(.*)$') {
                    $content[$Matches[1].Trim()] = $Matches[2].Trim()
                }
            }
        }
    }

    $content['SOLIDWORKS_PATH'] = $sw.Path
    $content['SOLIDWORKS_VERSION'] = $sw.Version
    if ($python) {
        $content['PYTHON'] = $python
    }
    if ($nodeWinax) {
        $nodeDir = Split-Path $nodeWinax -Parent
        $content['NODE_WINAX_PATH'] = ($nodeDir -replace '\\', '/')
    } else {
        $content.Remove('NODE_WINAX_PATH')
    }
    if ($Production) {
        $content.Remove('USE_MOCK_SOLIDWORKS')
    }

    $out = @()
    $order = @(
        'SOLIDWORKS_PATH', 'SOLIDWORKS_VERSION', 'SOLIDWORKS_MODELS_PATH', 'SOLIDWORKS_MACROS_PATH',
        'NODE_WINAX_PATH', 'PYTHON', 'CHROMA_HOST', 'CHROMA_PORT', 'LOG_LEVEL', 'USE_MOCK_SOLIDWORKS'
    )
    $written = @{}
    foreach ($key in $order) {
        if ($content.ContainsKey($key) -and $content[$key]) {
            $out += "$key=$($content[$key])"
            $written[$key] = $true
        }
    }
    foreach ($key in ($content.Keys | Sort-Object)) {
        if (-not $written[$key] -and $content[$key]) {
            $out += "$key=$($content[$key])"
        }
    }
    $out | Set-Content -Path $envFile -Encoding UTF8
}

Write-Host "[OK]   Versions detected:"
Write-Host "       Node (default): $nodeDefaultVer"
Write-Host "       Node (winax):   $nodeWinaxVer"
Write-Host "       Python:         $pythonVer"
Write-Host "       SolidWorks:     $($sw.Version) ($($sw.ProgId))"
Write-Host "       SW path:        $($sw.Path)"
Write-Host "       winax pin:      3.4.2"

if (-not $nodeWinax) {
    Write-Host "[WARN] No Node.js 20-22 found (current: $nodeDefaultVer). winax cannot compile on Node 24+." -ForegroundColor Yellow
    Write-Host "[WARN] Install Node 20: winget install OpenJS.NodeJS.20" -ForegroundColor Yellow
    Write-Host "[WARN] Then run: install.bat --install-deps" -ForegroundColor Yellow
    exit 1
}
if (-not $python) {
    Write-Host "[WARN] Python not found — winax build needs Python." -ForegroundColor Yellow
    exit 1
}
exit 0
