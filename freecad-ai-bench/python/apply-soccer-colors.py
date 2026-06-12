#!/usr/bin/env python3
"""Apply classic black/white panel colors to soccer_ball.FCStd (run in FreeCAD GUI)."""

import FreeCAD as App

doc = App.ActiveDocument
if doc is None:
    raise RuntimeError("Open soccer_ball.FCStd first")

panels = doc.getObject("Panels")
solid = doc.getObject("SoccerBall")
if panels is None:
    raise RuntimeError("Panels group not found")

if solid and solid.ViewObject:
    solid.ViewObject.Visibility = False

for obj in panels.Group:
    vo = obj.ViewObject
    if vo is None:
        continue
    if obj.Name.startswith("Pent_"):
        vo.ShapeColor = (0.06, 0.06, 0.06)
    else:
        vo.ShapeColor = (0.96, 0.96, 0.96)
    vo.LineColor = (0.2, 0.2, 0.2)
    vo.LineWidth = 1.5

doc.recompute()
App.Console.PrintMessage("Soccer ball colors applied (12 black pentagons, 20 white hexagons).\n")
