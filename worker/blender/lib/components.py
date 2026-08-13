"""
Placeholder 3D component generator for GundariuM Gundar-Frames.

Every mint rolls a KitbashTraits combination (frameType, head, primaryWeapon,
backpack, colorway, special). Real hand-modeled Blender assets for all ~94
distinct trait options don't exist yet, so this module procedurally builds a
deterministic, blocky mecha silhouette from primitives instead — same trait
name always produces the same shape and color.

This is a stand-in, not the final look. When real art exists, replace the
body of each build_* function with "append the matching object(s) from an
asset library .blend" — assemble.py's call sites and socket contract
(each build_* returns the object(s) it created, sockets are plain
mathutils.Vector world positions) do not need to change.
"""

import hashlib
import random

import bpy
from mathutils import Vector


# ─── Deterministic RNG ──────────────────────────────────────────────

def rng_for(category: str, name: str) -> random.Random:
    """Same (category, trait name) always yields the same seed."""
    digest = hashlib.sha256(f"{category}:{name}".encode("utf-8")).hexdigest()
    return random.Random(int(digest[:16], 16))


# ─── Colorway → material ────────────────────────────────────────────

_COLOR_KEYWORDS = {
    "white": (0.85, 0.86, 0.88),
    "blue": (0.10, 0.30, 0.75),
    "navy": (0.05, 0.12, 0.35),
    "red": (0.70, 0.05, 0.05),
    "char": (0.70, 0.05, 0.05),
    "crimson": (0.55, 0.02, 0.10),
    "maroon": (0.35, 0.05, 0.10),
    "green": (0.08, 0.45, 0.15),
    "olive": (0.25, 0.28, 0.10),
    "black": (0.03, 0.03, 0.04),
    "shadow": (0.03, 0.03, 0.04),
    "gold": (0.75, 0.58, 0.10),
    "silver": (0.65, 0.66, 0.68),
    "chrome": (0.70, 0.71, 0.73),
    "purple": (0.35, 0.10, 0.55),
    "violet": (0.35, 0.10, 0.55),
    "tan": (0.60, 0.48, 0.32),
    "brown": (0.35, 0.22, 0.12),
    "iron": (0.40, 0.24, 0.10),
    "rust": (0.45, 0.22, 0.08),
    "grey": (0.45, 0.46, 0.48),
    "gray": (0.45, 0.46, 0.48),
    "slate": (0.30, 0.34, 0.40),
    "charcoal": (0.15, 0.16, 0.18),
    "orange": (0.85, 0.40, 0.05),
    "pink": (0.90, 0.55, 0.70),
    "teal": (0.05, 0.45, 0.45),
    "emerald": (0.05, 0.45, 0.30),
    "lime": (0.55, 0.85, 0.15),
    "midnight": (0.04, 0.05, 0.12),
    "aurora": (0.55, 0.75, 0.85),
    "pastel": (0.70, 0.80, 0.90),
    "primary": (0.75, 0.15, 0.10),
    "translucent": (0.75, 0.85, 0.95),
}

_DEFAULT_BASE = (0.55, 0.56, 0.58)
_DEFAULT_ACCENT = (0.85, 0.66, 0.10)  # gold trim — matches the site accent


def colors_for_colorway(colorway: str):
    """Returns (base_rgb, accent_rgb, metallic) parsed from the colorway name."""
    lower = colorway.lower()
    found = [rgb for kw, rgb in _COLOR_KEYWORDS.items() if kw in lower]
    base = found[0] if found else _DEFAULT_BASE
    accent = found[1] if len(found) > 1 else _DEFAULT_ACCENT
    metallic = 0.7 if any(k in lower for k in ("chrome", "silver", "gold", "steel")) else 0.25
    return base, accent, metallic


def make_material(name: str, rgb, metallic: float, emissive: bool = False):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = 0.35
    if emissive and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*rgb, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 2.5
    return mat


# ─── Shared primitive helpers ───────────────────────────────────────

def _box(name, size, loc, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cube_add(size=size, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    return obj


def _cyl(name, radius, depth, loc, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_euler = rot
    return obj


def _cone(name, radius1, radius2, depth, loc, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(
        radius1=radius1, radius2=radius2, depth=depth, location=loc
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_euler = rot
    return obj


# ─── Frame (torso + limbs) ──────────────────────────────────────────

# Bounds the frameType RNG jitters within, per archetype family. Every
# frameType in TRAIT_TABLES.frameType maps to one of these; unrecognized
# names fall back to "standard" so a new trait added on the TS side never
# crashes the worker, it just renders as a default silhouette.
_FRAME_ARCHETYPES = {
    "standard": dict(torso_w=0.9, torso_h=1.1, torso_d=0.55, limb_r=0.16),
    "heavy": dict(torso_w=1.25, torso_h=1.2, torso_d=0.8, limb_r=0.24),
    "mobility": dict(torso_w=0.75, torso_h=1.15, torso_d=0.45, limb_r=0.13),
    "sniper": dict(torso_w=0.8, torso_h=1.2, torso_d=0.45, limb_r=0.14),
    "commander": dict(torso_w=0.95, torso_h=1.15, torso_d=0.6, limb_r=0.17),
    "berserker": dict(torso_w=1.1, torso_h=1.05, torso_d=0.7, limb_r=0.22),
    "stealth": dict(torso_w=0.8, torso_h=1.1, torso_d=0.4, limb_r=0.13),
    "full armor": dict(torso_w=1.35, torso_h=1.25, torso_d=0.9, limb_r=0.26),
}


def _archetype_for(frame_type: str) -> dict:
    lower = frame_type.lower()
    for key, params in _FRAME_ARCHETYPES.items():
        if key in lower:
            return params
    return _FRAME_ARCHETYPES["standard"]


def build_frame(frame_type: str, group_name: str):
    """Builds torso/pelvis/shoulders/arms/legs. Returns (objects, sockets)."""
    rng = rng_for("frameType", frame_type)
    p = _archetype_for(frame_type)
    jitter = lambda v: v * rng.uniform(0.92, 1.08)

    tw, th, td = jitter(p["torso_w"]), jitter(p["torso_h"]), jitter(p["torso_d"])
    limb_r = jitter(p["limb_r"])
    objects = []

    pelvis_z = 0.9
    torso_z = pelvis_z + th / 2 + 0.05
    objects.append(_box(f"{group_name}_pelvis", 1, (0, 0, pelvis_z), (tw * 0.7, td * 0.7, 0.3)))
    objects.append(_box(f"{group_name}_torso", 1, (0, 0, torso_z), (tw, td, th)))

    shoulder_x = tw / 2 + 0.18
    shoulder_z = torso_z + th / 2 - 0.1
    for side, sx in (("L", -1), ("R", 1)):
        objects.append(
            _box(f"{group_name}_shoulder_{side}", 1, (sx * shoulder_x, 0, shoulder_z), (0.32, 0.32, 0.28))
        )
        objects.append(
            _cyl(f"{group_name}_upperarm_{side}", limb_r, 0.55, (sx * shoulder_x, 0, shoulder_z - 0.4))
        )
        objects.append(
            _cyl(f"{group_name}_forearm_{side}", limb_r * 0.9, 0.5, (sx * shoulder_x, 0, shoulder_z - 0.9))
        )
        objects.append(
            _cyl(f"{group_name}_thigh_{side}", limb_r * 1.3, 0.6, (sx * tw * 0.28, 0, pelvis_z - 0.55))
        )
        objects.append(
            _cyl(f"{group_name}_shin_{side}", limb_r * 1.1, 0.6, (sx * tw * 0.28, 0, pelvis_z - 1.15))
        )
        objects.append(
            _box(f"{group_name}_foot_{side}", 1, (sx * tw * 0.28, 0.12, pelvis_z - 1.5), (0.28, 0.45, 0.14))
        )

    sockets = {
        "head": Vector((0, 0, torso_z + th / 2 + 0.05)),
        "back": Vector((0, -td / 2 - 0.05, torso_z + 0.1)),
        "hand": Vector((shoulder_x, -0.05, shoulder_z - 1.15)),
    }
    return objects, sockets


# ─── Head ────────────────────────────────────────────────────────────

def build_head(head_name: str, socket: Vector, group_name: str):
    rng = rng_for("head", head_name)
    r = 0.24 * rng.uniform(0.9, 1.1)
    objs = [_box(f"{group_name}_head", 1, (socket.x, socket.y, socket.z + r), (r, r * 0.9, r))]
    lower = head_name.lower()
    if "horn" in lower or "antenna" in lower or "fin" in lower or "crest" in lower or "blade" in lower:
        for side, sx in ((-1, -1), (1, 1)):
            objs.append(
                _cone(
                    f"{group_name}_horn_{side}",
                    0.02,
                    0.05 * rng.uniform(0.8, 1.6),
                    0.35 * rng.uniform(0.8, 1.4),
                    (socket.x + sx * 0.12, socket.y, socket.z + r * 1.9),
                    rot=(0, sx * 0.35, 0),
                )
            )
    elif "visor" in lower or "mono-eye" in lower or "slit" in lower:
        objs.append(
            _box(
                f"{group_name}_visor", 1,
                (socket.x, socket.y - r * 0.95, socket.z + r),
                (r * 0.85, 0.03, r * 0.25),
            )
        )
    return objs


# ─── Weapon ──────────────────────────────────────────────────────────

def build_weapon(weapon_name: str, socket: Vector, group_name: str):
    rng = rng_for("primaryWeapon", weapon_name)
    lower = weapon_name.lower()
    objs = []
    if any(k in lower for k in ("sword", "blade", "hawk", "katana", "shotel", "sabe", "naginata", "halberd")):
        length = 0.9 * rng.uniform(0.85, 1.3)
        objs.append(
            _box(f"{group_name}_weapon", 1, (socket.x + 0.15, socket.y, socket.z + length / 2), (0.05, 0.02, length))
        )
    elif any(k in lower for k in ("rifle", "cannon", "gun", "bazooka", "launcher", "carbine", "sniper")):
        length = 0.75 * rng.uniform(0.85, 1.3)
        objs.append(
            _cyl(f"{group_name}_weapon", 0.06 * rng.uniform(0.8, 1.4), length, (socket.x + 0.15, socket.y - length / 2 + 0.1, socket.z), rot=(1.5708, 0, 0))
        )
    else:
        objs.append(
            _box(f"{group_name}_weapon", 1, (socket.x + 0.15, socket.y, socket.z), (0.08, 0.3, 0.08))
        )
    return objs


# ─── Backpack ────────────────────────────────────────────────────────

def build_backpack(backpack_name: str, socket: Vector, group_name: str):
    rng = rng_for("backpack", backpack_name)
    lower = backpack_name.lower()
    objs = []
    if "wing" in lower or "binder" in lower or "petal" in lower or "flight" in lower:
        for side, sx in ((-1, -1), (1, 1)):
            objs.append(
                _box(
                    f"{group_name}_wing_{side}", 1,
                    (socket.x + sx * 0.35, socket.y - 0.05, socket.z + 0.1),
                    (0.28 * rng.uniform(0.8, 1.3), 0.03, 0.55 * rng.uniform(0.8, 1.3)),
                )
            )
    elif "drive" in lower or "reactor" in lower or "emitter" in lower or "condenser" in lower:
        objs.append(
            _cyl(f"{group_name}_core", 0.16 * rng.uniform(0.8, 1.3), 0.2, (socket.x, socket.y, socket.z), rot=(1.5708, 0, 0))
        )
    else:
        objs.append(
            _box(f"{group_name}_pack", 1, (socket.x, socket.y, socket.z), (0.32, 0.16, 0.4 * rng.uniform(0.85, 1.2)))
        )
    return objs


# ─── Special effects ─────────────────────────────────────────────────

def apply_special(special_name: str, torso_top: Vector, group_name: str):
    lower = special_name.lower()
    objs = []
    if lower == "none":
        return objs
    if "trans-am" in lower:
        obj = _cyl(f"{group_name}_transam_aura", 0.9, 0.05, (torso_top.x, torso_top.y, torso_top.z - 0.6))
        obj.data.materials.append(make_material(f"{group_name}_transam_mat", (0.9, 0.05, 0.05), 0.0, emissive=True))
        objs.append(obj)
    elif "psychoframe" in lower:
        for i in range(3):
            obj = _box(f"{group_name}_psycho_{i}", 1, (torso_top.x, torso_top.y, torso_top.z - 0.3 - i * 0.25), (0.5, 0.02, 0.02))
            obj.data.materials.append(make_material(f"{group_name}_psycho_mat_{i}", (0.6, 1.0, 0.75), 0.0, emissive=True))
            objs.append(obj)
    elif "gold trim" in lower:
        pass  # handled via accent material weighting in apply_materials
    return objs


# ─── Material application ───────────────────────────────────────────

def apply_materials(objects, colorway: str, group_name: str, accent_boost: bool = False):
    base_rgb, accent_rgb, metallic = colors_for_colorway(colorway)
    base_mat = make_material(f"{group_name}_base_mat", base_rgb, metallic)
    accent_mat = make_material(f"{group_name}_accent_mat", accent_rgb, max(metallic, 0.6))
    for obj in objects:
        if obj.data.materials:
            continue  # emissive specials already carry their own material
        is_accent = "shoulder" in obj.name or "foot" in obj.name or "wing" in obj.name
        obj.data.materials.append(accent_mat if (is_accent or accent_boost) else base_mat)
