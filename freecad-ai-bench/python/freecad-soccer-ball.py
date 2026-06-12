#!/usr/bin/env python3
"""
Generate a spherical soccer ball in FreeCAD.

Solid body: perfect sphere (FIFA-sized radius default 110 mm).
Surface pattern: 12 pentagons + 20 hexagons from truncated icosahedron topology,
each panel tessellated on the sphere so patches follow the curved surface.
"""

from __future__ import annotations

import math
import os
import sys

import FreeCAD as App
import Part

PHI = (1.0 + math.sqrt(5.0)) / 2.0
PANEL_SUBDIV = int(os.environ.get("SOCCER_PANEL_SUBDIV", "10"))

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


def _spherical_panel_shell(
    verts: list[App.Vector],
    ring: list[int],
    radius: float,
    subdiv: int,
) -> Part.Shape:
    """Tessellated spherical cap: small triangles with all vertices on the sphere."""
    corners = [verts[i] for i in ring]
    boundary = _subdivide_ring(corners, radius, subdiv)
    center = _panel_center(corners, radius)
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
    shell = Part.makeShell(faces)
    return Part.makeSolid(shell)


def _apply_panel_colors(group, sphere_obj) -> None:
    try:
        import FreeCADGui  # type: ignore

        svo = getattr(sphere_obj, "ViewObject", None)
        if svo is not None:
            svo.Visibility = False
        for i, child in enumerate(group.Group):
            vo = getattr(child, "ViewObject", None)
            if vo is None:
                continue
            vo.ShapeColor = (0.06, 0.06, 0.06) if i < len(PENTAGONS) else (0.96, 0.96, 0.96)
            vo.LineColor = (0.15, 0.15, 0.15)
            vo.LineWidth = 1.0
    except Exception:
        pass


def build_soccer_ball(radius_mm: float = 110.0) -> tuple[App.Document, Part.Solid]:
    verts = _scale_to_radius(_raw_vertices(), radius_mm)
    sphere = Part.makeSphere(radius_mm)

    doc = App.newDocument("SoccerBall")
    ball = doc.addObject("Part::Feature", "SoccerBall")
    ball.Label = f"Soccer ball R{radius_mm:g}mm"
    ball.Shape = sphere

    group = doc.addObject("App::DocumentObjectGroup", "Panels")
    subdiv = max(4, PANEL_SUBDIV)

    for i, ring in enumerate(PENTAGONS):
        panel = doc.addObject("Part::Feature", f"Pent_{i + 1:02d}")
        panel.Label = f"Pentagon {i + 1}"
        panel.Shape = _spherical_panel_shell(verts, ring, radius_mm, subdiv)
        group.addObject(panel)

    for i, ring in enumerate(HEXAGONS):
        panel = doc.addObject("Part::Feature", f"Hex_{i + 1:02d}")
        panel.Label = f"Hexagon {i + 1}"
        panel.Shape = _spherical_panel_shell(verts, ring, radius_mm, subdiv)
        group.addObject(panel)

    doc.recompute()
    _apply_panel_colors(group, ball)
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
        f"Spherical soccer ball R={radius:g}mm, volume={body.Volume:.1f} mm³ "
        f"(ideal sphere {ideal_volume:.1f})\n"
    )
    App.Console.PrintMessage(f"Saved FreeCAD: {out_path}\n")
    App.Console.PrintMessage(f"Saved STEP:    {step_path}\n")
    return 0


raise SystemExit(main())
