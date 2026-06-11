# Refresh PATH and run npm run dev (fixes stale PATH in Cursor PowerShell)
$machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$user = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($machine -and $user) { $env:Path = "$machine;$user" }
elseif ($machine) { $env:Path = $machine }
elseif ($user) { $env:Path = $user }

$nodeDir = Join-Path $env:ProgramFiles 'nodejs'
if ((Test-Path (Join-Path $nodeDir 'node.exe')) -and ($env:Path -notlike "*$nodeDir*")) {
    $env:Path = "$nodeDir;$env:Path"
}

Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host '[ERR]  Node.js not found. Install from https://nodejs.org/ then restart Cursor.' -ForegroundColor Red
    exit 1
}

npm run dev @args
