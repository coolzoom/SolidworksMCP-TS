On Error Resume Next
Set swApp = GetObject(, "SldWorks.Application.31")
If swApp Is Nothing Then
    Set swApp = CreateObject("SldWorks.Application.31")
End If

If swApp Is Nothing Then
    WScript.Echo "FAIL: Cannot get SolidWorks application"
    WScript.Quit 1
End If

swApp.Visible = True
WScript.Echo "OK: SolidWorks " & swApp.RevisionNumber

Set model = swApp.ActiveDoc
If model Is Nothing Then
    template = "C:\ProgramData\SolidWorks\SOLIDWORKS 2023\templates\Part.PRTDOT"
    Set model = swApp.NewDocument(template, 0, 0, 0)
    If model Is Nothing Then
        WScript.Echo "FAIL: NewDocument"
        WScript.Quit 1
    End If
    WScript.Echo "OK: Created part"
Else
    WScript.Echo "OK: Using active doc " & model.GetTitle
End If

model.ClearSelection2 True
model.Extension.SelectByID2 "Front Plane", "PLANE", 0, 0, 0, False, 0, Nothing, 0
model.SketchManager.InsertSketch True
Set circ = model.SketchManager.CreateCircle(0, 0, 0, 0.025, 0, 0)
If circ Is Nothing Then
    WScript.Echo "FAIL: CreateCircle"
    WScript.Quit 1
End If
model.SketchManager.InsertSketch True
model.EditRebuild3
WScript.Echo "OK: Circle created (radius 25mm)"
WScript.Quit 0
