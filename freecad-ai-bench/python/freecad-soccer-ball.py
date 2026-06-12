#!/usr/bin/env python3
"""
Generate a spherical soccer ball in FreeCAD.

- Solid export: perfect sphere (R=110 mm default)
- Visual: 12 black pent + 20 white hex separate curved patches with seam gaps
- Seam gaps show a dark underlayer between panels (Telstar style)
"""

from __future__ import annotations

import math
import os
import sys

import FreeCAD as App
import Part

PHI = (1.0 + math.sqrt(5.0)) / 2.0
PANEL_SUBDIV = int(os.environ.get("SOCCER_PANEL_SUBDIV", "10"))
PANEL_SHRINK = float(os.environ.get("SOCCER_PANEL_GAP", "0.86"))
PANEL_LIFT = float(os.environ.get("SOCCER_PANEL_LIFT", "1.004"))
SEAM_RADIUS = float(os.environ.get("SOCCER_SEAM_SCALE", "0.996"))

PENTAGONS = [
    [0, 28, 36, 39, 29],
    [1, 32, 41, 37, 30],
    [2, 33, 42, 38, 31],
    [3, 34, 40, 43, 35],
    [4, 12, 44, 47, 13],
    [5, 16, 49, 45, 14],
    [6, 17, 50, 46, 15],
    [7, 18, 48, 51, 19],
    [8, 20, 52, 55, 21],
    [9, 24, 57, 53, 22],
    [10, 25, 58, 54, 23],
    [11, 26, 56, 59, 27],
]

HEXAGONS = [
    [0, 2, 31, 55, 52, 28],
    [0, 29, 53, 57, 33, 2],
    [1, 3, 35, 59, 56, 32],
    [1, 30, 54, 58, 34, 3],
    [4, 6, 15, 39, 36, 12],
    [4, 13, 37, 41, 17, 6],
    [5, 7, 19, 43, 40, 16],
    [5, 14, 38, 42, 18, 7],
    [8, 10, 23, 47, 44, 20],
    [8, 21, 45, 49, 25, 10],
    [9, 11, 27, 51, 48, 24],
    [9, 22, 46, 50, 26, 11],
    [12, 36, 28, 52, 20, 44],
    [13, 47, 23, 54, 30, 37],
    [14, 45, 21, 55, 31, 38],
    [15, 46, 22, 53, 29, 39],
    [16, 40, 34, 58, 25, 49],
    [17, 41, 32, 56, 26, 50],
    [18, 42, 33, 57, 24, 48],
    [19, 51, 27, 59, 35, 43],
]


def _raw_vertices() -> list[tuple[float, float, float]]:
    a, b, c = 0.0, 1.0, 2.0
    d = PHI
    e, f, g, h = 3.0 * d, 1.0 + 2.0 * d, 2.0 + d, 2.0 * d
    return [
        (a, b, e), (a, b, -e), (a, -b, e), (a, -b, -e),
        (b, e, a), (b, -e, a), (-b, e, a), (-b, -e, a),
        (e, a, b), (-e, a, b), (e, a, -b), (-e, a, -b),
        (c, f, d), (c, f, -d), (c, -f, d), (-c, f, d),
        (c, -f, -d), (-c, f, -d), (-c, -f, d), (-c, -f, -d),
        (f, d, c), (f, -d, c), (-f, d, c), (f, d, -c),
        (-f, -d, c), (f, -d, -c), (-f, d, -c), (-f, -d, -c),
        (d, c, f), (-d, c, f), (d, c, -f), (d, -c, f),
        (-d, c, -f), (-d, -c, f), (d, -c, -f), (-d, -c, -f),
        (b, g, h), (b, g, -h), (b, -g, h), (-b, g, h),
        (b, -g, -h), (-b, g, -h), (-b, -g, h), (-b, -g, -h),
        (g, h, b), (g, -h, b), (-g, h, b), (g, h, -b),
        (-g, -h, b), (g, -h, -b), (-g, h, -b), (-g, -h, -b),
        (h, b, g), (-h, b, g), (h, b, -g), (h, -b, g),
        (-h, b, -g), (-h, -b, g), (h, -b, -g), (-h, -b, -g),
    ]


def _scale_to_radius(raw: list[tuple[float, float, float]], radius_mm: float) -> list[App.Vector]:
    vecs = [App.Vector(x, y, z) for x, y, z in raw]
    max_len = max(v.Length for v in vecs)
    factor = radius_mm / max_len
    return [App.Vector(v.x * factor, v.y * factor, v.z * factor) for v in vecs]


def _on_sphere(v: App.Vector, radius: float) -> App.Vector:
    length = v.Length
    if length <= 1e-9:
        return v
    s = radius / length
    return App.Vector(v.x * s, v.y * s, v.z * s)


def _slerp_on_sphere(a: App.Vector, b: App.Vector, t: float, radius: float) -> App.Vector:
    return _on_sphere(
        App.Vector(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t),
        radius,
    )


def _subdivide_ring(points: list[App.Vector], radius: float, steps: int) -> list[App.Vector]:
    ring: list[App.Vector] = []
    count = len(points)
    for i in range(count):
        a = points[i]
        b = points[(i + 1) % count]
        for k in range(steps):
            ring.append(_slerp_on_sphere(a, b, k / steps, radius))
    return ring


def _panel_center(points: list[App.Vector], radius: float) -> App.Vector:
    cx = sum(p.x for p in points) / len(points)
    cy = sum(p.y for p in points) / len(points)
    cz = sum(p.z for p in points) / len(points)
    return _on_sphere(App.Vector(cx, cy, cz), radius)


def _shrink_corners(corners: list[App.Vector], radius: float, shrink: float) -> list[App.Vector]:
    """Move panel corners toward center on the sphere, leaving seam gaps at edges."""
    center = _panel_center(corners, radius)
    out: list[App.Vector] = []
    for p in corners:
        v = App.Vector(
            center.x + (p.x - center.x) * shrink,
            center.y + (p.y - center.y) * shrink,
            center.z + (p.z - center.z) * shrink,
        )
        out.append(_on_sphere(v, radius))
    return out


def _spherical_panel_shell(
    verts: list[App.Vector],
    ring: list[int],
    radius: float,
    subdiv: int,
    *,
    shrink: float = PANEL_SHRINK,
    lift: float = PANEL_LIFT,
) -> Part.Shape:
    surface_r = radius * lift
    corners = [_on_sphere(verts[i], surface_r) for i in ring]
    corners = _shrink_corners(corners, surface_r, shrink)
    boundary = _subdivide_ring(corners, surface_r, subdiv)
    center = _panel_center(corners, surface_r)
    faces: list[Part.Face] = []
    for i in range(len(boundary)):
        a = boundary[i]
        b = boundary[(i + 1) % len(boundary)]
        try:
            faces.append(Part.Face(Part.Wire(Part.makePolygon([center, a, b, center]))))
        except Exception:
            continue
    if not faces:
        return Part.Shape()
    return Part.makeSolid(Part.makeShell(faces))


def _set_view_color(
    obj,
    shape_rgb: tuple[float, float, float],
    *,
    line_rgb: tuple[float, float, float] = (0.25, 0.25, 0.25),
    visible: bool = True,
) -> None:
    vo = getattr(obj, "ViewObject", None)
    if vo is None:
        return
    vo.ShapeColor = shape_rgb
    vo.LineColor = line_rgb
    vo.LineWidth = 1.0
    vo.Visibility = visible
    if hasattr(vo, "DisplayMode"):
        vo.DisplayMode = "Shaded"


def _apply_telstar_colors(ball, seam, pent_group, hex_group) -> None:
    _set_view_color(ball, (1.0, 1.0, 1.0), visible=False)
    _set_view_color(seam, (0.03, 0.03, 0.03), line_rgb=(0.1, 0.1, 0.1))
    for child in pent_group.Group:
        _set_view_color(child, (0.04, 0.04, 0.04), line_rgb=(0.12, 0.12, 0.12))
    for child in hex_group.Group:
        _set_view_color(child, (0.97, 0.97, 0.97), line_rgb=(0.35, 0.35, 0.35))


def build_soccer_ball(radius_mm: float = 110.0) -> tuple[App.Document, Part.Solid]:
    verts = _scale_to_radius(_raw_vertices(), radius_mm)
    sphere = Part.makeSphere(radius_mm)

    doc = App.newDocument("SoccerBall")

    ball = doc.addObject("Part::Feature", "SoccerBall")
    ball.Label = f"Soccer ball solid R{radius_mm:g}mm"
    ball.Shape = sphere

    seam = doc.addObject("Part::Feature", "Seams")
    seam.Label = "Seam underlayer"
    seam.Shape = Part.makeSphere(radius_mm * SEAM_RADIUS)

    pent_group = doc.addObject("App::DocumentObjectGroup", "BlackPentagons")
    hex_group = doc.addObject("App::DocumentObjectGroup", "WhiteHexagons")
    subdiv = max(6, PANEL_SUBDIV)

    for i, ring in enumerate(PENTAGONS):
        panel = doc.addObject("Part::Feature", f"Pent_{i + 1:02d}")
        panel.Label = f"Black pentagon {i + 1}"
        panel.Shape = _spherical_panel_shell(verts, ring, radius_mm, subdiv)
        pent_group.addObject(panel)

    for i, ring in enumerate(HEXAGONS):
        panel = doc.addObject("Part::Feature", f"Hex_{i + 1:02d}")
        panel.Label = f"White hexagon {i + 1}"
        panel.Shape = _spherical_panel_shell(verts, ring, radius_mm, subdiv)
        hex_group.addObject(panel)

    doc.recompute()
    _apply_telstar_colors(ball, seam, pent_group, hex_group)
    return doc, sphere


def main() -> int:
    radius = float(os.environ.get("SOCCER_BALL_RADIUS") or (sys.argv[1] if len(sys.argv) > 1 else 110.0))
    out_path = os.environ.get("SOCCER_BALL_OUTPUT") or (
        sys.argv[2] if len(sys.argv) > 2 else "soccer_ball.FCStd"
    )
    out_path = os.path.abspath(out_path)
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)

    doc, body = build_soccer_ball(radius)
    doc.saveAs(out_path)
    step_path = os.path.splitext(out_path)[0] + ".step"
    Part.export([body], step_path)

    ideal_volume = 4.0 / 3.0 * math.pi * radius**3
    App.Console.PrintMessage(
        f"Spherical soccer ball R={radius:g}mm, panels=32 with gaps, "
        f"solid volume={body.Volume:.1f} mm³ (ideal {ideal_volume:.1f})\n"
    )
    App.Console.PrintMessage(f"Saved FreeCAD: {out_path}\n")
    App.Console.PrintMessage(f"Saved STEP:    {step_path}\n")
    return 0


raise SystemExit(main())
