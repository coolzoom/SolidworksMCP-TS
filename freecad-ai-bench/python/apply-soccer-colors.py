#!/usr/bin/env python3
"""Apply Telstar black/white panel colors with seam gaps (run in FreeCAD GUI)."""

import FreeCAD as App

doc = App.ActiveDocument
if doc is None:
    raise RuntimeError("Open soccer_ball.FCStd first")

ball = doc.getObject("SoccerBall")
seam = doc.getObject("Seams")
pents = doc.getObject("BlackPentagons")
hexes = doc.getObject("WhiteHexagons")

if ball and ball.ViewObject:
    ball.ViewObject.Visibility = False

if seam and seam.ViewObject:
    seam.ViewObject.ShapeColor = (0.03, 0.03, 0.03)
    seam.ViewObject.Visibility = True

if pents:
    for obj in pents.Group:
        vo = obj.ViewObject
        if vo:
            vo.ShapeColor = (0.04, 0.04, 0.04)
            vo.LineColor = (0.12, 0.12, 0.12)
            vo.Visibility = True

if hexes:
    for obj in hexes.Group:
        vo = obj.ViewObject
        if vo:
            vo.ShapeColor = (0.97, 0.97, 0.97)
            vo.LineColor = (0.35, 0.35, 0.35)
            vo.Visibility = True

doc.recompute()
App.Console.PrintMessage("Applied: black pentagons + white hexagons + dark seams.\n")
