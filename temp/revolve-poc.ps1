# Revolve POC via PowerShell COM (bypass winax SelectByID2 issues)
$R = 0.025
$sw = New-Object -ComObject SldWorks.Application
$sw.Visible = $true

$template = $sw.GetUserPreferenceStringValue(8)
$model = $sw.NewDocument($template, 0, 0, 0)
Write-Host "Part:" $model.GetTitle()

$model.SketchManager.InsertSketch($true) | Out-Null
$model.SketchManager.CreateCenterLine(0, -$R, 0, 0, $R, 0) | Out-Null
$model.SketchManager.Create3PointArc(-$R, 0, 0, $R, 0, 0, 0, 0, 0) | Out-Null
$model.SketchManager.InsertSketch($true) | Out-Null

$feat = $model.FeatureByPositionReverse(0)
$sketchName = $feat.Name
Write-Host "Sketch:" $sketchName

$model.ClearSelection2($true) | Out-Null
$feat.Select2($false, 0) | Out-Null

# Try SelectByID2 for axis via PowerShell COM
$axisName = "Line1@$sketchName"
try {
  $ok = $model.Extension.SelectByID2($axisName, "SKETCHSEGMENT", 0, 0, 0, $true, 16, $null, 0)
  Write-Host "SelectByID2 axis =>" $ok
} catch {
  Write-Host "SelectByID2 axis ERR:" $_.Exception.Message
}

# Try GetSketchSegments + Select4
try {
  $sketch = $feat.GetSpecificFeature2()
  $segs = $sketch.GetSketchSegments()
  Write-Host "Segments count:" $segs.Count
  for ($i = 0; $i -lt $segs.Count; $i++) {
    $seg = $segs[$i]
    if ($seg.ConstructionGeometry) {
      $sel = $seg.Select4($true, $null)
      Write-Host "Select4 construction seg =>" $sel
      break
    }
  }
} catch {
  Write-Host "GetSketchSegments ERR:" $_.Exception.Message
}

# FeatureRevolve
try {
  $angle = [Math]::PI * 2
  $rev = $model.FeatureManager.FeatureRevolve($false, $false, $angle, 0, $false, $false, $false, $true)
  if ($rev) { Write-Host "FeatureRevolve =>" $rev.Name } else { Write-Host "FeatureRevolve => null" }
} catch {
  Write-Host "FeatureRevolve ERR:" $_.Exception.Message
}

# FeatureRevolve2 (10 params from working VBA examples)
try {
  $model.ClearSelection2($true) | Out-Null
  $feat.Select2($false, 0) | Out-Null
  $sketch = $feat.GetSpecificFeature2()
  $segs = $sketch.GetSketchSegments()
  for ($i = 0; $i -lt $segs.Count; $i++) {
    if ($segs[$i].ConstructionGeometry) { $segs[$i].Select4($true, $null) | Out-Null; break }
  }
  $rev2 = $model.FeatureManager.FeatureRevolve2($false, $false, $angle, 0, 0, 0, $true, $true, 0, 0)
  if ($rev2) { Write-Host "FeatureRevolve2(10) =>" $rev2.Name } else { Write-Host "FeatureRevolve2(10) => null" }
} catch {
  Write-Host "FeatureRevolve2 ERR:" $_.Exception.Message
}

Write-Host "Done"
