#!/usr/bin/env python3
"""Export TechDraw PDF from GUI after opening the CNC FCStd."""

import FreeCAD as App

doc = App.ActiveDocument
if doc is None:
    raise RuntimeError("Open gantry_5axis_cnc_1200x1000.FCStd first")

page = doc.getObject("Sheet_GeneralArrangement")
if page is None:
    raise RuntimeError("Drawing sheet missing; regenerate model with freecad-gantry-5axis-cnc.py")

import FreeCADGui as Gui

out = doc.FileName.replace(".FCStd", "_GA.pdf")
Gui.export([page], out)
App.Console.PrintMessage(f"Exported PDF: {out}\n")
