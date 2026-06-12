"""Reusable precise mechanical primitives for CNC machine CAD."""

from __future__ import annotations

import math

import FreeCAD as App
import Part


def box(dx: float, dy: float, dz: float, x: float = 0.0, y: float = 0.0, z: float = 0.0) -> Part.Shape:
    return Part.makeBox(dx, dy, dz, App.Vector(x, y, z))


def cyl(
    r: float,
    h: float,
    x: float = 0.0,
    y: float = 0.0,
    z: float = 0.0,
    *,
    axis: App.Vector | None = None,
) -> Part.Shape:
    return Part.makeCylinder(r, h, App.Vector(x, y, z), axis or App.Vector(0, 0, 1))


def fuse_all(shapes: list[Part.Shape]) -> Part.Shape:
    valid = [s for s in shapes if s and not s.isNull()]
    if not valid:
        return Part.Shape()
    out = valid[0]
    for s in valid[1:]:
        out = out.fuse(s)
    return out


def cut_all(base: Part.Shape, cutters: list[Part.Shape]) -> Part.Shape:
    out = base
    for c in cutters:
        if c and not c.isNull():
            out = out.cut(c)
    return out


def ribbed_block(
    dx: float,
    dy: float,
    dz: float,
    *,
    rib_t: float = 22.0,
    rib_pitch: float = 140.0,
    x: float = 0.0,
    y: float = 0.0,
    z: float = 0.0,
) -> Part.Shape:
    body = box(dx, dy, dz, x, y, z)
    ribs: list[Part.Shape] = [body]
    count = max(1, int(dx / rib_pitch))
    for i in range(count):
        rx = x + (i + 0.5) * (dx / count) - rib_t * 0.5
        ribs.append(box(rib_t, dy * 0.82, dz * 0.92, rx, y + dy * 0.09, z + dz * 0.04))
    return fuse_all(ribs)


def hollow_beam(
    length_y: float,
    height_z: float,
    width_x: float,
    wall: float,
    *,
    x: float = 0.0,
    y: float = 0.0,
    z: float = 0.0,
) -> Part.Shape:
    outer = box(width_x, length_y, height_z, x, y, z)
    inner = box(
        width_x - 2 * wall,
        length_y - 2 * wall,
        height_z - 2 * wall,
        x + wall,
        y + wall,
        z + wall,
    )
    return outer.cut(inner)


def linear_guide_rail(length: float, *, y: float, z: float, x0: float = 0.0) -> Part.Shape:
    profile_w = 45.0
    profile_h = 32.0
    rail = box(length, profile_w, profile_h, x0, y - profile_w * 0.5, z)
    v = box(length, 8, 6, x0, y - 4, z + profile_h - 6)
    return fuse_all([rail, v])


def linear_guide_block(*, x: float, y: float, z: float) -> Part.Shape:
    return fuse_all(
        [
            box(80, 120, 58, x - 40, y - 60, z),
            box(70, 90, 18, x - 35, y - 45, z + 58),
            box(60, 20, 12, x - 30, y - 10, z - 12),
        ]
    )


def ball_screw_assembly(
    length: float,
    screw_d: float,
    *,
    x: float,
    y: float,
    z: float,
    axis: App.Vector,
) -> Part.Shape:
    axis_n = axis.normalize()
    screw = cyl(screw_d * 0.5, length, x, y, z, axis=axis_n)
    nut = cyl(screw_d * 0.75, 80, x, y, z, axis=axis_n)
    housing = box(screw_d * 1.6, screw_d * 1.6, 95, x - screw_d * 0.8, y - screw_d * 0.8, z)
    return fuse_all([screw, nut.translate(axis_n * length * 0.45), housing])


def servo_motor(
    *,
    x: float,
    y: float,
    z: float,
    flange: float = 130.0,
    body_l: float = 260.0,
) -> Part.Shape:
    return fuse_all(
        [
            cyl(flange * 0.5, 18, x, y, z),
            cyl(flange * 0.42, body_l, x, y, z + 18),
            box(flange, flange, 40, x - flange * 0.5, y - flange * 0.5, z + 18 + body_l),
        ]
    )


def bolt_hole_m16(x: float, y: float, z: float, depth: float) -> Part.Shape:
    return cyl(8.5, depth, x, y, z - depth)


def bolt_pattern(
    x0: float,
    y0: float,
    nx: int,
    ny: int,
    pitch_x: float,
    pitch_y: float,
    z: float,
    depth: float,
) -> list[Part.Shape]:
    holes: list[Part.Shape] = []
    for ix in range(nx):
        for iy in range(ny):
            holes.append(bolt_hole_m16(x0 + ix * pitch_x, y0 + iy * pitch_y, z, depth))
    return holes


def hsk63_spindle(*, x: float, y: float, z: float) -> Part.Shape:
    return fuse_all(
        [
            cyl(95, 45, x, y, z),
            cyl(70, 120, x, y, z - 120),
            cyl(63, 35, x, y, z - 155),
            cyl(40, 80, x, y, z - 190),
            Part.makeCone(63, 45, 25, App.Vector(x, y, z - 215), App.Vector(0, 0, -1)),
        ]
    )


def end_mill(*, x: float, y: float, z: float, d: float = 16.0, flute_l: float = 75.0) -> Part.Shape:
    return fuse_all(
        [
            cyl(d * 0.5, flute_l, x, y, z - flute_l),
            cyl(d * 0.35, 40, x, y, z - flute_l - 40),
            box(20, 8, 12, x - 10, y + d * 0.4, z - 15),
        ]
    )


def t_slot_plate(diameter: float, thickness: float, slot_w: float, slot_d: float, pitch: float) -> Part.Shape:
    plate = cyl(diameter * 0.5, thickness, 0, 0, 0)
    cutters: list[Part.Shape] = []
    half = diameter * 0.42
    for i in range(-5, 6):
        off = i * pitch
        cutters.append(box(slot_w, diameter * 0.9, slot_d, -half, -slot_w * 0.5 + off, thickness - slot_d))
        cutters.append(box(diameter * 0.9, slot_w, slot_d, -slot_w * 0.5 + off, -half, thickness - slot_d))
    return cut_all(plate, cutters)


def cable_chain(length: float, *, x: float, y: float, z: float) -> Part.Shape:
    links: list[Part.Shape] = []
    n = max(4, int(length / 55))
    for i in range(n):
        links.append(box(42, 28, 22, x + i * 55, y, z + (i % 2) * 8))
    return fuse_all(links)


def accordion_cover(length: float, width: float, convolutions: int, *, x: float, y: float, z: float) -> Part.Shape:
    parts: list[Part.Shape] = []
    step = length / max(convolutions, 1)
    for i in range(convolutions):
        h = 16 + (i % 3) * 6
        parts.append(box(step * 0.85, width, h, x + i * step, y, z))
    return fuse_all(parts)


def set_view(obj, rgb: tuple[float, float, float], *, alpha: int = 0) -> None:
    vo = getattr(obj, "ViewObject", None)
    if vo is None:
        return
    vo.ShapeColor = rgb
    vo.LineColor = tuple(max(0.0, c - 0.12) for c in rgb)
    vo.Visibility = True
    if hasattr(vo, "Transparency"):
        vo.Transparency = alpha
    if hasattr(vo, "DisplayMode"):
        vo.DisplayMode = "Shaded"


def add_part(
    doc,
    name: str,
    shape: Part.Shape,
    group=None,
    *,
    placement: App.Placement | None = None,
    color: tuple[float, float, float] | None = None,
    alpha: int = 0,
):
    obj = doc.addObject("Part::Feature", name)
    obj.Shape = shape
    if placement is not None:
        obj.Placement = placement
    if group is not None:
        group.addObject(obj)
    if color:
        set_view(obj, color, alpha=alpha)
    return obj
