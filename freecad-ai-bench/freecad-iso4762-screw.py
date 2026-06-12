#!/usr/bin/env python3
"""
Generate ISO 4762 hex socket head cap screw in FreeCAD.

With Fasteners Workbench installed and SCREW_THREAD=real (default), generates
precise ISO metric external threads (Thread=True).

Usage (headless):
  set SCREW_SIZE=M3
  set SCREW_LENGTH=20
  set SCREW_THREAD=real
  FreeCADCmd scripts/freecad-iso4762-screw.py

Fallback (no Fasteners): SCREW_THREAD=simple uses Part primitives + cosmetic grooves.
"""

from __future__ import annotations

import math
import os
import sys

import FreeCAD as App
import Part

# Nominal ISO 4762 dimensions (mm), aligned with src/standards/iso4762.ts
ISO4762 = {
    "M3": {"d": 3, "pitch": 0.5, "dk": 5.5, "k": 3, "s": 2.5, "t": 1.5, "chamfer": 0.2},
    "M4": {"d": 4, "pitch": 0.7, "dk": 7, "k": 4, "s": 3, "t": 2, "chamfer": 0.25},
    "M5": {"d": 5, "pitch": 0.8, "dk": 8.5, "k": 5, "s": 4, "t": 2.5, "chamfer": 0.3},
    "M6": {"d": 6, "pitch": 1.0, "dk": 10, "k": 6, "s": 5, "t": 3, "chamfer": 0.35},
    "M8": {"d": 8, "pitch": 1.25, "dk": 13, "k": 8, "s": 6, "t": 4, "chamfer": 0.4},
    "M10": {"d": 10, "pitch": 1.5, "dk": 16, "k": 10, "s": 8, "t": 5, "chamfer": 0.5},
}


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_thread_mode() -> str:
    raw = (os.environ.get("SCREW_THREAD") or "real").strip().lower()
    if raw in {"real", "simple", "none", "off", "false", "0"}:
        return "none" if raw in {"none", "off", "false", "0"} else raw
    return "real"


def _fasteners_available() -> bool:
    mod_dir = os.path.join(App.getUserAppDataDir(), "Mod", "Fasteners")
    return os.path.isdir(mod_dir)


def _hex_points(af: float, z: float) -> list:
    r = af / math.sqrt(3)
    return [
        App.Vector(r * math.cos(math.pi / 6 + i * math.pi / 3), r * math.sin(math.pi / 6 + i * math.pi / 3), z)
        for i in range(6)
    ]


def _find_top_head_edge(shape: Part.Shape, z_top: float, radius: float, tol: float = 0.05):
    best = None
    best_score = float("inf")
    for edge in shape.Edges:
        if not isinstance(edge.Curve, Part.Circle):
            continue
        center = edge.CenterOfMass
        if abs(center.z - z_top) > tol:
            continue
        score = abs(edge.Curve.Radius - radius) + abs(center.z - z_top)
        if score < best_score:
            best_score = score
            best = edge
    return best


def _add_cosmetic_thread(body: Part.Shape, radius: float, length: float, pitch: float) -> Part.Shape:
    try:
        groove_depth = pitch * 0.12
        turns = max(length / pitch, 1.0)
        helix = Part.makeHelix(pitch, length, radius - groove_depth, 0, 0, turns)
        profile = Part.makeCircle(groove_depth * 0.55, helix.valueAt(0), App.Vector(1, 0, 0))
        groove = Part.Wire([profile]).makePipeShell([Part.Wire([helix])], True, False)
        if not groove.isNull():
            return body.cut(groove)
    except Exception:
        pass
    return body


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


def build_screw_fasteners(
    size: str,
    length_mm: float,
    *,
    real_thread: bool = True,
) -> tuple[App.Document, App.DocumentObject]:
    import FastenersCmd  # noqa: PLC0415
    import ScrewMaker  # noqa: PLC0415

    key = size.upper()
    if key not in ISO4762:
        supported = ", ".join(sorted(ISO4762))
        raise ValueError(f'Unsupported size "{size}". Supported: {supported}')

    sm = ScrewMaker.Instance
    lengths = sm.GetAllLengths("ISO4762", key, True)
    if not lengths:
        raise ValueError(f"No standard lengths found for ISO4762 {key}")

    length_choice = _pick_length(lengths, length_mm)
    doc = App.newDocument(f"{key}x{int(length_mm)}")
    obj = doc.addObject("Part::FeaturePython", "ISO4762")
    FastenersCmd.FSScrewObject(obj, "ISO4762", None)
    obj.Label = f"{key}×{length_mm:g} ISO4762"
    obj.Diameter = key
    obj.Length = lengths
    obj.Length = length_choice
    if length_choice == "Custom" and hasattr(obj, "LengthCustom"):
        obj.LengthCustom = float(length_mm)
    if hasattr(obj, "Thread"):
        obj.Thread = real_thread

    App.Console.PrintMessage(
        f"Fasteners ISO4762 {key} length={obj.Length} thread={'real' if real_thread else 'off'}\n"
    )
    doc.recompute()
    return doc, obj


def build_screw_simple(
    size: str = "M3",
    length_mm: float = 20.0,
    *,
    head_chamfer: bool = True,
    cosmetic_thread: bool = True,
) -> tuple[App.Document, Part.Shape]:
    key = size.upper()
    if key not in ISO4762:
        supported = ", ".join(sorted(ISO4762))
        raise ValueError(f'Unsupported size "{size}". Supported: {supported}')

    spec = ISO4762[key]
    shank_r = spec["d"] / 2
    shank_l = float(length_mm)
    head_r = spec["dk"] / 2
    head_k = spec["k"]
    z_head_base = shank_l
    z_head_top = shank_l + head_k

    doc = App.newDocument(f"{key}x{int(shank_l)}")
    shank = Part.makeCylinder(shank_r, shank_l, App.Vector(0, 0, 0), App.Vector(0, 0, 1))
    head = Part.makeCylinder(head_r, head_k, App.Vector(0, 0, z_head_base), App.Vector(0, 0, 1))
    body = shank.fuse(head)

    hex_pts = _hex_points(spec["s"], z_head_top)
    hex_pts.append(hex_pts[0])
    hex_prism = Part.Face(Part.Wire(Part.makePolygon(hex_pts))).extrude(App.Vector(0, 0, -spec["t"]))
    body = body.cut(hex_prism)

    if head_chamfer and spec["chamfer"] > 0:
        edge = _find_top_head_edge(body, z_head_top, head_r)
        if edge is not None:
            try:
                body = body.makeChamfer(spec["chamfer"], spec["chamfer"], [edge])
            except Exception:
                cone_h = spec["chamfer"] * 2
                cone = Part.makeCone(head_r, head_r - spec["chamfer"], cone_h, App.Vector(0, 0, z_head_top - cone_h))
                body = body.cut(cone)

    if cosmetic_thread:
        body = _add_cosmetic_thread(body, shank_r, shank_l, spec["pitch"])

    obj = doc.addObject("Part::Feature", f"{key}_Screw")
    obj.Label = f"{key}×{shank_l:g} ISO4762 (simple)"
    obj.Shape = body
    doc.recompute()
    return doc, body


def main() -> int:
    size = os.environ.get("SCREW_SIZE") or (sys.argv[1] if len(sys.argv) > 1 else "M3")
    length = float(os.environ.get("SCREW_LENGTH") or (sys.argv[2] if len(sys.argv) > 2 else 20.0))
    out_path = os.environ.get("SCREW_OUTPUT") or (
        sys.argv[3] if len(sys.argv) > 3 else f"{size}x{int(length)}_iso4762.FCStd"
    )
    thread_mode = _env_thread_mode()

    out_path = os.path.abspath(out_path)
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)

    use_fasteners = thread_mode == "real" and _fasteners_available()
    if thread_mode == "real" and not _fasteners_available():
        App.Console.PrintWarning(
            "Fasteners Workbench not found. Install with scripts/install-freecad-fasteners.ps1 "
            "or set SCREW_THREAD=simple.\n"
        )

    if use_fasteners:
        doc, obj = build_screw_fasteners(size, length, real_thread=True)
        export_obj = obj
    else:
        doc, body = build_screw_simple(
            size,
            length,
            cosmetic_thread=thread_mode == "simple",
        )
        export_obj = doc.Objects[0]

    doc.saveAs(out_path)
    step_path = os.path.splitext(out_path)[0] + ".step"
    Part.export([export_obj], step_path)

    App.Console.PrintMessage(f"Saved FreeCAD: {out_path}\n")
    App.Console.PrintMessage(f"Saved STEP:    {step_path}\n")
    return 0


raise SystemExit(main())
