$ErrorActionPreference = 'Continue'
$sw = [Runtime.InteropServices.Marshal]::GetActiveObject('SldWorks.Application')
Write-Host "Revision:" $sw.RevisionNumber()
Write-Host "Visible:" $sw.Visible
$doc = $sw.ActiveDoc
if ($doc) {
    Write-Host "ActiveDoc:" $doc.GetTitle
} else {
    Write-Host "ActiveDoc: (none)"
}

Write-Host "Templates:"
Get-ChildItem 'C:\ProgramData\SolidWorks' -Filter 'Part.prtdot' -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 5 | ForEach-Object { Write-Host "  $($_.FullName)" }

Write-Host "NewPart type:"
try {
    $r = $sw.NewPart()
    Write-Host "  NewPart OK:" ($r -ne $null)
} catch {
    Write-Host "  NewPart FAIL:" $_.Exception.Message
}
