"""TechDraw engineering sheet export for gantry CNC."""

from __future__ import annotations

import glob
import os

import FreeCAD as App


def _find_template() -> str | None:
    roots = [
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "FreeCAD 1.1", "data", "Mod", "TechDraw", "Templates"),
        r"C:\Program Files\FreeCAD 1.1\data\Mod\TechDraw\Templates",
        os.path.join(os.environ.get("FREECAD_USER_DATA", ""), "Mod", "TechDraw", "Templates"),
    ]
    patterns = (
        "A2_Landscape_CN_CLIP.svg",
        "A2_Landscape_ISO5457_advanced.svg",
        "A2_Landscape_ISO5457_minimal.svg",
        "A2_Landscape_blank.svg",
        "A3_Landscape.svg",
        "A4_Landscape.svg",
    )
    for root in roots:
        if not root or not os.path.isdir(root):
            continue
        for pattern in patterns:
            hits = glob.glob(os.path.join(root, "**", pattern), recursive=True)
            if hits:
                return hits[0]
    return None


def create_drawing_sheet(doc: App.Document, source_objects: list, spec=None) -> bool:
    try:
        import TechDraw
    except ImportError:
        App.Console.PrintWarning("TechDraw module unavailable; skipping 2D drawings.\n")
        return False

    template_path = _find_template()
    if not template_path:
        App.Console.PrintWarning("TechDraw template not found; skipping 2D drawings.\n")
        return False

    solids = [o for o in source_objects if hasattr(o, "Shape") and o.Shape and not o.Shape.isNull()]
    if not solids:
        App.Console.PrintWarning("No solid sources for TechDraw views.\n")
        return False

    try:
        import Part

        page = doc.addObject("TechDraw::DrawPage", "Sheet_GeneralArrangement")
        page.Label = "General Arrangement A2"

        tmpl = doc.addObject("TechDraw::DrawSVGTemplate", "DrawingTemplate")
        tmpl.Template = template_path.replace("\\", "/")
        page.Template = tmpl

        shapes = [o.Shape for o in solids[:12]]
        compound = doc.addObject("Part::Feature", "DrawingSource")
        compound.Shape = Part.makeCompound(shapes) if len(shapes) > 1 else shapes[0]

        views = [
            ("View_Front", App.Vector(0, -1, 0), App.Vector(50, 220, 0), 0.08),
            ("View_Top", App.Vector(0, 0, -1), App.Vector(50, 60, 0), 0.08),
            ("View_Right", App.Vector(1, 0, 0), App.Vector(280, 220, 0), 0.08),
        ]
        for name, direction, pos, scale in views:
            view = doc.addObject("TechDraw::DrawViewPart", name)
            view.Source = [compound]
            view.Direction = direction
            view.X = pos.x
            view.Y = pos.y
            view.Scale = scale
            page.addView(view)

        x_t = getattr(spec, "x_travel", 1200)
        y_t = getattr(spec, "y_travel", 1000)
        z_t = getattr(spec, "z_travel", 600)
        model = getattr(spec, "model", "G5X-120100")
        rev = getattr(spec, "revision", "A.1")

        for label, text, x, y in (
            ("DimLbl_Model", f"{model} Rev.{rev}", 120, 5),
            ("DimLbl_X", f"X travel {x_t:g} mm", 120, 22),
            ("DimLbl_Y", f"Y travel {y_t:g} mm", 120, 37),
            ("DimLbl_Z", f"Z travel {z_t:g} mm", 120, 52),
            ("DimLbl_Base", f"Bed {getattr(spec, 'base_length', 2400):g} x {getattr(spec, 'base_width', 1900):g} mm", 120, 67),
            ("DimLbl_Spindle", f"{getattr(spec, 'spindle_taper', 'HSK-A63')} {getattr(spec, 'spindle_power_kw', 15):g} kW", 120, 82),
        ):
            ann = doc.addObject("TechDraw::DrawViewAnnotation", label)
            ann.Text = [text]
            ann.X = x
            ann.Y = y
            page.addView(ann)

        doc.recompute()
        App.Console.PrintMessage("TechDraw sheet created: Sheet_GeneralArrangement\n")
        return True
    except Exception as exc:
        App.Console.PrintWarning(f"TechDraw generation skipped: {exc}\n")
        return False


def export_pdf(doc: App.Document, pdf_path: str) -> bool:
    page = doc.getObject("Sheet_GeneralArrangement")
    if page is None:
        return False
    try:
        import TechDraw

        if hasattr(TechDraw, "exportPageAsPdf"):
            TechDraw.exportPageAsPdf(page, pdf_path)
            App.Console.PrintMessage(f"Saved drawing PDF: {pdf_path}\n")
            return True
    except Exception as exc:
        App.Console.PrintWarning(f"Headless PDF export unavailable: {exc}\n")
    App.Console.PrintMessage(
        "Open FCStd in FreeCAD GUI -> TechDraw -> Sheet_GeneralArrangement -> File -> Export PDF\n"
    )
    return False
