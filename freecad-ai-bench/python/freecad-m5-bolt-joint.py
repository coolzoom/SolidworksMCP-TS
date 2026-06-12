#!/usr/bin/env python3
"""
M5 bolt joint assembly: ISO4762 screw + ISO7089 washer + ISO4032 nut.

Uses Fasteners Workbench (standard parts, real threads when available).
Layout along -Z: screw head at top, washer under head, optional plate, nut on thread end.
"""

from __future__ import annotations

import os
import sys

import FreeCAD as App
import Part

SIZE = os.environ.get("BOLT_SIZE", "M5")
SCREW_LENGTH = float(os.environ.get("BOLT_LENGTH", "60"))
SCREW_TYPE = os.environ.get("BOLT_SCREW_TYPE", "ISO4762")
NUT_TYPE = os.environ.get("BOLT_NUT_TYPE", "ISO4032")
WASHER_TYPE = os.environ.get("BOLT_WASHER_TYPE", "ISO7089")
REAL_THREAD = os.environ.get("BOLT_THREAD", "real").strip().lower() not in {
    "none",
    "off",
    "false",
    "0",
    "simple",
}
OUT_PATH = os.environ.get(
    "BOLT_OUTPUT",
    os.path.join(os.path.dirname(__file__), "..", "output", "M5_bolt_joint_assembly.FCStd"),
)


def _pick_length(lengths: list[str], requested: float) -> str:
    req = str(int(requested)) if float(requested).is_integer() else str(requested)
    if req in lengths:
        return req
    if "Custom" in lengths:
        return "Custom"
    numeric = [float(x) for x in lengths if x.replace(".", "", 1).isdigit()]
    if not numeric:
        return lengths[0]
    closest = min(numeric, key=lambda x: abs(x - requested))
    return str(int(closest)) if closest.is_integer() else str(closest)


def _make_fastener(doc, name: str, ftype: str, *, length: float | None = None, thread: bool = True):
    import FastenersCmd  # noqa: PLC0415
    import ScrewMaker  # noqa: PLC0415

    obj = doc.addObject("Part::FeaturePython", name)
    FastenersCmd.FSScrewObject(obj, ftype, None)
    obj.Diameter = SIZE
    if length is not None and hasattr(obj, "Length"):
        sm = ScrewMaker.Instance
        lengths = sm.GetAllLengths(ftype, SIZE, True)
        if not lengths:
            raise ValueError(f"No lengths for {ftype} {SIZE}")
        choice = _pick_length(lengths, length)
        obj.Length = lengths
        obj.Length = choice
        if choice == "Custom" and hasattr(obj, "LengthCustom"):
            obj.LengthCustom = float(length)
    if hasattr(obj, "Thread"):
        obj.Thread = thread
    return obj


def _bb(obj):
    return obj.Shape.BoundBox


def _set_color(obj, rgb: tuple[float, float, float]) -> None:
    if not App.GuiUp:
        return
    vo = obj.ViewObject
    vo.ShapeColor = rgb
    vo.Transparency = 0


def build_assembly() -> tuple[App.Document, list]:
    import FastenersCmd  # noqa: PLC0415

    doc_name = f"{SIZE}_bolt_joint"
    if doc_name in App.listDocuments():
        App.closeDocument(doc_name)

    doc = App.newDocument(doc_name)
    thread = REAL_THREAD

    screw = _make_fastener(doc, "Screw", SCREW_TYPE, length=SCREW_LENGTH, thread=thread)
    screw.Label = f"{SIZE}×{SCREW_LENGTH:g} {SCREW_TYPE}"

    washer = _make_fastener(doc, "Washer", WASHER_TYPE, thread=False)
    washer.Label = f"{SIZE} {WASHER_TYPE}"

    nut = _make_fastener(doc, "Nut", NUT_TYPE, thread=thread)
    nut.Label = f"{SIZE} {NUT_TYPE}"

    doc.recompute()

    sbb = _bb(screw)
    wbb = _bb(washer)
    nbb = _bb(nut)

    # Screw: head at +Z, shank/thread toward -Z. Junction head/shank ≈ sbb.ZMax - head_height.
    # Fasteners ISO4762: shank starts at z=0, head above; tip at negative Z.
    head_bottom_z = 0.0

    washer_pl = washer.Placement
    washer_pl.Base.z = head_bottom_z - wbb.ZMax
    washer.Placement = washer_pl

    doc.recompute()
    wbb = _bb(washer)

    # Demo plate (20×20 mm, 3 mm thick) sitting on washer
    plate_t = 3.0
    plate_half = 10.0
    plate = doc.addObject("Part::Feature", "Plate")
    plate.Label = "Demo Plate 20×20×3"
    plate.Shape = Part.makeBox(
        plate_half * 2,
        plate_half * 2,
        plate_t,
        App.Vector(-plate_half, -plate_half, wbb.ZMin - plate_t),
    )

    thread_end_z = sbb.ZMin
    nut_pl = nut.Placement
    nut_pl.Base.z = thread_end_z - nbb.ZMax
    nut.Placement = nut_pl

    doc.recompute()

    group = doc.addObject("App::DocumentObjectGroup", "BoltJoint")
    group.Label = f"{SIZE} Bolt Joint"
    group.addObject(screw)
    group.addObject(washer)
    group.addObject(plate)
    group.addObject(nut)

    _set_color(screw, (0.72, 0.75, 0.78))
    _set_color(washer, (0.85, 0.82, 0.55))
    _set_color(nut, (0.65, 0.68, 0.72))
    _set_color(plate, (0.55, 0.58, 0.62))

    if App.GuiUp:
        import FreeCADGui as Gui

        Gui.activeDocument().activeView().viewIsometric()
        Gui.SendMsgToActiveView("ViewFit")

    doc.recompute()
    return doc, [screw, washer, plate, nut]


def main() -> int:
    out_path = os.path.abspath(OUT_PATH)
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)

    doc, parts = build_assembly()
    doc.saveAs(out_path)

    step_path = os.path.splitext(out_path)[0] + ".step"
    Part.export(parts, step_path)

    screw, washer, plate, nut = parts
    App.Console.PrintMessage(f"Saved FreeCAD: {out_path}\n")
    App.Console.PrintMessage(f"Saved STEP:    {step_path}\n")
    App.Console.PrintMessage(
        f"Assembly: {screw.Label} + {washer.Label} + {plate.Label} + {nut.Label}\n"
    )
    App.Console.PrintMessage(f"Thread mode: {'real' if REAL_THREAD else 'off'}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
