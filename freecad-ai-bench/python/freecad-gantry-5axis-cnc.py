#!/usr/bin/env python3
"""
G5X-120100 — detailed gantry 5-axis CNC (1200 x 1000 x 600 mm).

Outputs:
  - FCStd assembly with full machine structure
  - STEP solids
  - JSON design specification
  - TechDraw general arrangement sheet (+ PDF when supported)
"""

from __future__ import annotations

import os
import sys

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)

import FreeCAD as App
import Part

from cnc.gantry_builder import build_machine, load_spec_from_env
from cnc.techdraw_export import create_drawing_sheet, export_pdf


def main() -> int:
    spec = load_spec_from_env()
    out_path = os.environ.get("CNC_OUTPUT") or (
        sys.argv[1] if len(sys.argv) > 1 else "gantry_5axis_cnc_1200x1000.FCStd"
    )
    out_path = os.path.abspath(out_path)
    out_dir = os.path.dirname(out_path) or "."
    os.makedirs(out_dir, exist_ok=True)

    doc = App.newDocument(spec.model)
    build_machine(doc, spec)

    json_path = os.path.join(out_dir, f"{spec.model}_design_spec.json")
    spec.save_json(json_path)
    App.Console.PrintMessage(f"Saved design spec: {json_path}\n")

    major = [
        doc.getObject("BedCasting"),
        doc.getObject("CrossBeam"),
        doc.getObject("Z_Ram"),
        doc.getObject("SpindleUnit"),
        doc.getObject("C_Platter"),
        doc.getObject("A_Trunnion"),
    ]
    major = [o for o in major if o is not None]
    create_drawing_sheet(doc, major, spec)

    doc.recompute()
    doc.saveAs(out_path)

    solids = [o for o in doc.Objects if hasattr(o, "Shape") and o.Shape and o.Shape.Solids]
    if solids:
        step_path = os.path.splitext(out_path)[0] + ".step"
        Part.export(solids, step_path)
        App.Console.PrintMessage(f"Saved STEP: {step_path} ({len(solids)} solids)\n")

    pdf_path = os.path.splitext(out_path)[0] + "_GA.pdf"
    export_pdf(doc, pdf_path)

    App.Console.PrintMessage(
        f"{spec.model} complete design: X={spec.x_travel:g} Y={spec.y_travel:g} Z={spec.z_travel:g} mm\n"
    )
    App.Console.PrintMessage(f"Saved FreeCAD: {out_path}\n")
    return 0


raise SystemExit(main())
