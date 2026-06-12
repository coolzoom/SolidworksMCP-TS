"""Detailed gantry 5-axis CNC assembly builder."""

from __future__ import annotations

import math
import os
import sys

# Allow running as FreeCADCmd script from repo python/ folder
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, os.path.dirname(_SCRIPT_DIR))

import FreeCAD as App
import Part

from cnc.machine_spec import DEFAULT_SPEC, MachineSpec
from cnc import part_library as P


COLORS = {
    "base": (0.36, 0.37, 0.39),
    "rail": (0.55, 0.56, 0.58),
    "guide": (0.2, 0.22, 0.24),
    "screw": (0.68, 0.7, 0.72),
    "cast": (0.5, 0.54, 0.58),
    "servo": (0.1, 0.1, 0.12),
    "spindle": (0.82, 0.45, 0.1),
    "table": (0.6, 0.62, 0.65),
    "trunnion": (0.34, 0.52, 0.36),
    "sheet": (0.78, 0.8, 0.84),
    "cabinet": (0.25, 0.27, 0.3),
    "accent": (0.15, 0.55, 0.28),
}


def _group(doc, name: str, parent=None):
    g = doc.addObject("App::DocumentObjectGroup", name)
    if parent:
        parent.addObject(g)
    return g


def build_foundation(doc, spec: MachineSpec, parent):
    g = _group(doc, "01_Foundation", parent)
    bx, by, bz = spec.base_length, spec.base_width, spec.base_height
    slab = P.ribbed_block(bx, by, bz, rib_pitch=180)
    pads: list[Part.Shape] = []
    for px, py in (
        (120, 120),
        (bx - 120, 120),
        (120, by - 120),
        (bx - 120, by - 120),
        (bx * 0.5, 120),
        (bx * 0.5, by - 120),
    ):
        pads.append(P.cyl(spec.leveling_pad_d * 0.5, 25, px, py, -25))
    slab = P.fuse_all([slab, *pads])

    ox, oy = spec.table_origin_x() - 100, spec.table_origin_y() - 100
    tray = P.box(spec.x_travel + 200, spec.y_travel + 200, 22, ox, oy, bz - 22)
    slab = P.fuse_all([slab, tray])

    holes = P.bolt_pattern(150, 150, 4, 3, 500, 450, bz, 40)
    slab = P.cut_all(slab, holes)
    chip = P.box(spec.chip_conveyor_w, spec.y_travel + 120, 120, ox + 40, oy - 80, bz - 120)
    slab = P.cut_all(slab, [chip])

    P.add_part(doc, "BedCasting", slab, g, color=COLORS["base"])
    for i, (px, py) in enumerate(
        (
            (120, 120),
            (bx - 120, 120),
            (120, by - 120),
            (bx - 120, by - 120),
        )
    ):
        P.add_part(doc, f"LevelPad_{i + 1}", P.cyl(spec.leveling_pad_d * 0.5, 18, px, py, bz), g, color=COLORS["guide"])
    return bz


def build_x_axis(doc, spec: MachineSpec, parent, z_rail: float):
    g = _group(doc, "02_X_Axis", parent)
    x0 = (spec.base_length - spec.x_rail_length) * 0.5
    for i, ry in enumerate((spec.x_rail_y1, spec.x_rail_y2)):
        rail = P.linear_guide_rail(spec.x_rail_length, y=ry, z=z_rail, x0=x0)
        P.add_part(doc, f"X_GuideRail_{i + 1}", rail, g, color=COLORS["guide"])
        for j in range(8):
            bx = x0 + 120 + j * 220
            P.add_part(
                doc,
                f"X_CarriageBlock_{i + 1}_{j + 1}",
                P.linear_guide_block(x=bx, y=ry, z=z_rail + 32),
                g,
                color=COLORS["rail"],
            )
        cover = P.accordion_cover(spec.x_rail_length - 100, 55, 28, x=x0 + 50, y=ry - 80, z=z_rail - 8)
        P.add_part(doc, f"X_Bellows_{i + 1}", cover, g, color=COLORS["sheet"], alpha=35)

    screw_y = spec.base_width * 0.5
    screw = P.cyl(spec.x_ballscrew_d * 0.5, spec.x_rail_length, x0, screw_y, z_rail + 55, axis=App.Vector(1, 0, 0))
    P.add_part(doc, "X_BallScrew", screw, g, color=COLORS["screw"])
    P.add_part(
        doc,
        "X_BallNut",
        P.box(spec.x_ballscrew_d * 1.8, spec.x_ballscrew_d * 1.8, 95, x0 + spec.x_rail_length * 0.48, screw_y - spec.x_ballscrew_d * 0.9, z_rail + 40),
        g,
        color=COLORS["cast"],
    )
    for side, sx in (("Left", x0 + 80), ("Right", x0 + spec.x_rail_length - 80)):
        P.add_part(
            doc,
            f"X_Servo_{side}",
            P.servo_motor(x=sx, y=screw_y, z=z_rail + 20),
            g,
            color=COLORS["servo"],
        )


def build_gantry(doc, spec: MachineSpec, parent, z_leg: float):
    g = _group(doc, "03_Gantry_YZ", parent)
    xg = spec.gantry_x_home()
    y1, y2 = spec.x_rail_y1, spec.x_rail_y2
    z_top = z_leg + spec.gantry_height
    leg_h = z_top - z_leg - spec.beam_height

    for tag, y in (("Left", y1), ("Right", y2)):
        leg = P.ribbed_block(
            spec.leg_section_x,
            spec.leg_section_y,
            leg_h,
            x=xg - spec.leg_section_x * 0.5,
            y=y - spec.leg_section_y * 0.5,
            z=z_leg,
            rib_pitch=120,
        )
        P.add_part(doc, f"GantryLeg_{tag}", leg, g, color=COLORS["cast"])

    beam_y0 = y1 - 60
    beam_len = y2 - y1 + 120
    beam = P.hollow_beam(
        beam_len,
        spec.beam_height,
        spec.beam_width,
        spec.beam_wall,
        x=xg - spec.beam_width * 0.5,
        y=beam_y0,
        z=z_top - spec.beam_height,
    )
    P.add_part(doc, "CrossBeam", beam, g, color=COLORS["cast"])

    y_mid = spec.table_center()[1]
    saddle_z = z_top - spec.beam_height + 35
    saddle = P.fuse_all(
        [
            P.box(460, 380, 210, xg - 230, y_mid - 190, saddle_z),
            P.linear_guide_block(x=xg - 180, y=y_mid, z=saddle_z + 210),
            P.linear_guide_block(x=xg + 180, y=y_mid, z=saddle_z + 210),
        ]
    )
    P.add_part(doc, "Y_Saddle", saddle, g, color=COLORS["rail"])

    y_rail = P.linear_guide_rail(spec.y_rail_length, y=y_mid, z=z_top - spec.beam_height + 12, x0=xg - spec.y_rail_length * 0.5)
    P.add_part(doc, "Y_GuideRail", y_rail, g, color=COLORS["guide"])
    y_screw = P.cyl(
        spec.y_ballscrew_d * 0.5,
        spec.y_rail_length,
        xg - spec.y_rail_length * 0.5,
        y_mid,
        z_top - spec.beam_height + 80,
        axis=App.Vector(1, 0, 0),
    )
    P.add_part(doc, "Y_BallScrew", y_screw, g, color=COLORS["screw"])
    P.add_part(doc, "Y_Servo", P.servo_motor(x=xg + spec.beam_width * 0.5 + 90, y=y_mid, z=saddle_z + 40), g, color=COLORS["servo"])

    z0 = saddle_z - spec.z_travel
    ram = P.fuse_all(
        [
            P.box(spec.z_ram_x, spec.z_ram_y, spec.z_travel, xg - spec.z_ram_x * 0.5, y_mid - spec.z_ram_y * 0.5, z0),
            P.linear_guide_block(x=xg - spec.z_guide_span * 0.5, y=y_mid, z=saddle_z + 210),
            P.linear_guide_block(x=xg + spec.z_guide_span * 0.5, y=y_mid, z=saddle_z + 210),
        ]
    )
    P.add_part(doc, "Z_Ram", ram, g, color=COLORS["cast"])
    z_screw = P.cyl(spec.z_ballscrew_d * 0.5, spec.z_travel + 80, xg, y_mid + spec.z_ram_y * 0.35, z0 - 40)
    P.add_part(doc, "Z_BallScrew", z_screw, g, color=COLORS["screw"])
    P.add_part(doc, "Z_Servo", P.servo_motor(x=xg, y=y_mid - spec.z_ram_y * 0.5 - 150, z=saddle_z + 120), g, color=COLORS["servo"])

    spindle_z = z0 - 215
    P.add_part(doc, "SpindleUnit", P.hsk63_spindle(x=xg, y=y_mid, z=spindle_z), g, color=COLORS["spindle"])
    P.add_part(doc, "Tool", P.end_mill(x=xg, y=y_mid, z=spindle_z, d=16, flute_l=spec.tool_flute_l), g, color=(0.75, 0.75, 0.78))
    P.add_part(
        doc,
        "SpindleMotor",
        P.box(220, 180, 170, xg - 110, y_mid - 90, saddle_z + 220),
        g,
        color=COLORS["servo"],
    )
    return z_top


def build_rotary_table(doc, spec: MachineSpec, parent, z_table: float):
    g = _group(doc, "04_AC_Table", parent)
    cx, cy = spec.table_center()

    frame = P.ribbed_block(
        spec.trunnion_width + 160,
        spec.trunnion_depth + 160,
        140,
        x=cx - (spec.trunnion_width + 160) * 0.5,
        y=cy - (spec.trunnion_depth + 160) * 0.5,
        z=z_table - 140,
        rib_pitch=130,
    )
    P.add_part(doc, "TableBase", frame, g, color=COLORS["cast"])

    tw, td, th = spec.trunnion_width, spec.trunnion_depth, spec.trunnion_height
    cradle = P.fuse_all(
        [
            P.box(tw, td, th, -tw * 0.5, -td * 0.5, 0),
            P.cyl(spec.trunnion_bearing_d * 0.5, td + 60, -tw * 0.5 - 95, 0, th * 0.5, axis=App.Vector(1, 0, 0)),
            P.cyl(spec.trunnion_bearing_d * 0.5, td + 60, tw * 0.5 + 95, 0, th * 0.5, axis=App.Vector(1, 0, 0)),
            P.box(120, 90, 70, -tw * 0.5 - 150, -45, th * 0.25),
            P.box(120, 90, 70, tw * 0.5 + 30, -45, th * 0.25),
        ]
    )
    P.add_part(
        doc,
        "A_Trunnion",
        cradle,
        g,
        placement=App.Placement(App.Vector(cx, cy, z_table), App.Rotation(App.Vector(1, 0, 0), spec.display_a_deg)),
        color=COLORS["trunnion"],
    )

    platter = P.t_slot_plate(spec.platter_d, spec.platter_t, spec.t_slot_w, spec.t_slot_depth, spec.t_slot_pitch)
    P.add_part(
        doc,
        "C_Platter",
        platter,
        g,
        placement=App.Placement(
            App.Vector(cx, cy, z_table),
            App.Rotation(App.Vector(0, 0, 1), spec.display_c_deg) * App.Rotation(App.Vector(1, 0, 0), spec.display_a_deg),
        ),
        color=COLORS["table"],
    )

    env = P.box(spec.x_travel, spec.y_travel, 3, cx - spec.x_travel * 0.5, cy - spec.y_travel * 0.5, z_table + 1)
    P.add_part(doc, "WorkZone_1200x1000", env, g, color=COLORS["accent"], alpha=55)

    P.add_part(doc, "A_Servo", P.servo_motor(x=cx - tw * 0.5 - 210, y=cy, z=z_table + 40), g, color=COLORS["servo"])
    P.add_part(doc, "C_Servo", P.servo_motor(x=cx, y=cy + td * 0.5 + 120, z=z_table - 80), g, color=COLORS["servo"])


def build_peripherals(doc, spec: MachineSpec, parent, z_top: float):
    g = _group(doc, "05_Peripherals", parent)
    bx, by = spec.base_length, spec.base_width
    h = spec.guard_height

    for name, shape, alpha in (
        ("GuardFront", P.box(bx - 160, 28, h, 80, 50, 0), 72),
        ("GuardRear", P.box(bx - 160, 28, h, 80, by - 78, 0), 72),
        ("GuardLeft", P.box(28, by - 100, h, 50, 80, 0), 72),
        ("GuardRight", P.box(28, by - 100, h, bx - 78, 80, 0), 72),
    ):
        P.add_part(doc, name, shape, g, color=COLORS["sheet"], alpha=alpha)

    cab_x = bx + 80
    cab = P.box(spec.cabinet_w, spec.cabinet_d, spec.cabinet_h, cab_x, by * 0.5 - spec.cabinet_d * 0.5, 0)
    P.add_part(doc, "ControlCabinet", cab, g, color=COLORS["cabinet"])
    P.add_part(doc, "CoolantTank", P.box(spec.coolant_tank_l, 500, 420, cab_x + spec.cabinet_w + 40, 200, 0), g, color=COLORS["cabinet"])
    P.add_part(doc, "CableChain_X", P.cable_chain(900, x=200, y=spec.x_rail_y1 - 160, z=z_top - 400), g, color=COLORS["guide"])


def build_datum_geometry(doc, spec: MachineSpec, parent):
    g = _group(doc, "06_Datums", parent)
    cx, cy = spec.table_center()
    z = spec.z_table_top() + 5
    for name, p1, p2 in (
        ("Dim_X_Travel", App.Vector(cx - spec.x_travel * 0.5, cy - spec.y_travel * 0.5 - 80, z), App.Vector(spec.x_travel, 0, 0)),
        ("Dim_Y_Travel", App.Vector(cx - spec.x_travel * 0.5 - 80, cy - spec.y_travel * 0.5, z), App.Vector(0, spec.y_travel, 0)),
        ("Dim_Z_Travel", App.Vector(cx + spec.x_travel * 0.5 + 100, cy, z + 80), App.Vector(0, 0, spec.z_travel)),
    ):
        shaft = Part.makeCylinder(6, p2.Length * 0.82, p1, p2)
        tip = Part.makeCone(14, 0, p2.Length * 0.18, p1 + p2 * 0.82, p2)
        color = (0.85, 0.2, 0.2) if "X" in name else (0.2, 0.75, 0.25) if "Y" in name else (0.2, 0.3, 0.85)
        P.add_part(doc, name, shaft.fuse(tip), g, color=color)


def build_machine(doc: App.Document, spec: MachineSpec) -> App.Document:
    root = _group(doc, f"{spec.model}_Assembly")
    root.Label = f"{spec.model} {spec.x_travel:g}x{spec.y_travel:g}x{spec.z_travel:g} 5-axis gantry"

    z_bed = build_foundation(doc, spec, root)
    z_rail = z_bed + 25
    build_x_axis(doc, spec, root, z_rail)
    z_leg = z_rail + 32
    z_top = build_gantry(doc, spec, root, z_leg)
    build_rotary_table(doc, spec, root, spec.z_table_top())
    build_peripherals(doc, spec, root, z_top)
    build_datum_geometry(doc, spec, root)

    txt = doc.addObject("App::FeaturePython", "DesignSpec")
    txt.Label = (
        f"{spec.model} Rev.{spec.revision} | "
        f"X{spec.x_travel:g}/Y{spec.y_travel:g}/Z{spec.z_travel:g} | "
        f"A±{spec.a_range_deg:g} C{spec.c_range_deg:g} | "
        f"{spec.spindle_taper} {spec.spindle_power_kw:g}kW {spec.spindle_rpm_max}rpm"
    )
    root.addObject(txt)
    doc.recompute()
    return doc


def load_spec_from_env() -> MachineSpec:
    def f(name: str, default: float) -> float:
        v = os.environ.get(name)
        return float(v) if v else default

    return MachineSpec(
        x_travel=f("CNC_X_TRAVEL", DEFAULT_SPEC.x_travel),
        y_travel=f("CNC_Y_TRAVEL", DEFAULT_SPEC.y_travel),
        z_travel=f("CNC_Z_TRAVEL", DEFAULT_SPEC.z_travel),
        display_a_deg=f("CNC_A_TILT", DEFAULT_SPEC.display_a_deg),
        display_c_deg=f("CNC_C_ANGLE", DEFAULT_SPEC.display_c_deg),
    )
