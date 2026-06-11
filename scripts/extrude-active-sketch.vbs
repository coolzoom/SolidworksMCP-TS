' Extrude the most recent sketch in the active SolidWorks part.
On Error Resume Next

Dim depthMm, depthM
depthMm = 8
depthM = depthMm / 1000

Set swApp = GetObject(, "SldWorks.Application.31")
If swApp Is Nothing Then
    WScript.Echo "FAIL: SolidWorks not running"
    WScript.Quit 1
End If

Set model = swApp.ActiveDoc
If model Is Nothing Then
    WScript.Echo "FAIL: No active document"
    WScript.Quit 1
End If

WScript.Echo "OK: Active doc " & model.GetTitle

model.ClearSelection2 True

Dim feat, typeName, sketchFeat
Set sketchFeat = Nothing
Dim i, count
count = model.GetFeatureCount()

For i = 0 To count - 1
    Set feat = model.FeatureByPositionReverse(i)
    If Not feat Is Nothing Then
        typeName = feat.GetTypeName2()
        If typeName = "ProfileFeature" Then
            Set sketchFeat = feat
            Exit For
        End If
    End If
Next

If sketchFeat Is Nothing Then
    WScript.Echo "FAIL: No sketch found"
    WScript.Quit 1
End If

sketchFeat.Select2 False, 0
WScript.Echo "OK: Selected sketch " & sketchFeat.Name

Dim featMgr
Set featMgr = model.FeatureManager
If featMgr Is Nothing Then
    WScript.Echo "FAIL: No FeatureManager"
    WScript.Quit 1
End If

' FeatureExtrusion2: blind extrude single direction
Dim extFeat
Set extFeat = featMgr.FeatureExtrusion2(True, False, False, 0, 0, depthM, 0.0, False, False, False, False, 0.0, 0.0, False, False, False, False, True, True, True, 0, 0, False)
If extFeat Is Nothing Then
    WScript.Echo "FAIL: FeatureExtrusion2 returned Nothing"
    WScript.Quit 1
End If

model.EditRebuild3
model.ViewZoomtofit2
WScript.Echo "OK: Extrusion created, depth " & depthMm & "mm"
WScript.Quit 0
