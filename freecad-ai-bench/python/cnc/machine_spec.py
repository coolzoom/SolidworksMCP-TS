"""Parametric specification for G5X-120100 gantry 5-axis machining center."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
import json


@dataclass(frozen=True)
class MachineSpec:
    model: str = "G5X-120100"
    revision: str = "A.1"

    # Travels (mm)
    x_travel: float = 1200.0
    y_travel: float = 1000.0
    z_travel: float = 600.0
    a_range_deg: float = 110.0
    c_range_deg: float = 360.0

    # Base / foundation
    base_length: float = 2400.0
    base_width: float = 1900.0
    base_height: float = 350.0
    base_material: str = "HT250 cast iron"
    anchor_bolt: str = "M16 x 400, 16 holes, grid 500 mm"
    leveling_pad_d: float = 80.0

    # X axis
    x_rail_length: float = 2100.0
    x_rail_y1: float = 280.0
    x_rail_y2: float = 1620.0
    x_rail_profile: str = "Linear guide 45 mm (HGH45CA class)"
    x_ballscrew_d: float = 63.0
    x_ballscrew_pitch: float = 10.0
    x_ballscrew_grade: str = "C5"
    x_servo_kw: float = 3.0
    x_servo_qty: int = 2

    # Gantry
    leg_section_x: float = 420.0
    leg_section_y: float = 380.0
    gantry_height: float = 2450.0
    beam_height: float = 520.0
    beam_width: float = 420.0
    beam_wall: float = 35.0

    # Y axis
    y_rail_length: float = 1380.0
    y_ballscrew_d: float = 50.0
    y_ballscrew_pitch: float = 10.0
    y_servo_kw: float = 2.5

    # Z axis
    z_ram_x: float = 340.0
    z_ram_y: float = 300.0
    z_guide_span: float = 280.0
    z_ballscrew_d: float = 40.0
    z_ballscrew_pitch: float = 10.0
    z_servo_kw: float = 2.0

    # Spindle
    spindle_taper: str = "HSK-A63"
    spindle_power_kw: float = 15.0
    spindle_rpm_max: int = 24000
    spindle_nose_to_table_min: float = 180.0
    tool_shank_d: float = 63.0
    tool_flute_l: float = 75.0

    # Rotary table (A/C)
    trunnion_width: float = 980.0
    trunnion_depth: float = 320.0
    trunnion_height: float = 220.0
    trunnion_bearing_d: float = 110.0
    platter_d: float = 1100.0
    platter_t: float = 40.0
    t_slot_w: float = 18.0
    t_slot_depth: float = 12.0
    t_slot_pitch: float = 125.0
    a_servo_kw: float = 1.5
    c_servo_kw: float = 1.0

    # Peripherals
    guard_height: float = 2700.0
    cabinet_w: float = 600.0
    cabinet_d: float = 800.0
    cabinet_h: float = 1800.0
    chip_conveyor_w: float = 380.0
    coolant_tank_l: float = 800.0

    # Presentation (3D view pose, not machine limits)
    display_a_deg: float = 0.0
    display_c_deg: float = 0.0

    def table_origin_x(self) -> float:
        return (self.base_length - self.x_travel) * 0.5

    def table_origin_y(self) -> float:
        return (self.base_width - self.y_travel) * 0.5

    def table_center(self) -> tuple[float, float]:
        return (
            self.table_origin_x() + self.x_travel * 0.5,
            self.table_origin_y() + self.y_travel * 0.5,
        )

    def gantry_x_home(self) -> float:
        return self.table_origin_x() + self.x_travel * 0.5

    def z_table_top(self) -> float:
        return self.base_height + 45.0

    def to_dict(self) -> dict:
        return asdict(self)

    def save_json(self, path: str) -> None:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)


DEFAULT_SPEC = MachineSpec()
