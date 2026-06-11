$ErrorActionPreference = 'Continue'

function Invoke-Sw([object]$sw, [string]$name, [object[]]$args = @()) {
    return $sw.GetType().InvokeMember($name, 'InvokeMethod', $null, $sw, $args)
}

function Test-Sw([object]$sw, [string]$label) {
    Write-Host "`n--- $label ---"
    try {
        $rev = Invoke-Sw $sw 'RevisionNumber'
        Write-Host "RevisionNumber: $rev"
    } catch { Write-Host "RevisionNumber FAIL: $($_.Exception.Message)" }

    try {
        $doc = $sw.GetType().InvokeMember('ActiveDoc', 'GetProperty', $null, $sw, $null)
        if ($doc) { Write-Host "ActiveDoc: $(Invoke-Sw $doc 'GetTitle')" } else { Write-Host "ActiveDoc: none" }
    } catch { Write-Host "ActiveDoc FAIL: $($_.Exception.Message)" }
}

# Method 1: Running instance via ROT
try {
    $sw1 = [Runtime.InteropServices.Marshal]::GetActiveObject('SldWorks.Application.31')
    Test-Sw $sw1 'GetActiveObject(.31)'
} catch { Write-Host "GetActiveObject(.31) FAIL: $($_.Exception.Message)" }

# Method 2: GetObject syntax
try {
    Add-Type -AssemblyName Microsoft.VisualBasic
    $sw2 = [Microsoft.VisualBasic.Interaction]::GetObject($null, 'SldWorks.Application.31')
    Test-Sw $sw2 'GetObject(.31)'
} catch { Write-Host "GetObject(.31) FAIL: $($_.Exception.Message)" }

# Method 3: New instance
try {
    $type = [Type]::GetTypeFromProgID('SldWorks.Application.31')
    $sw3 = [Activator]::CreateInstance($type)
    Test-Sw $sw3 'CreateInstance(.31)'
} catch { Write-Host "CreateInstance FAIL: $($_.Exception.Message)" }
