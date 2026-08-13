"""
Headless Blender entry point for the GundariuM 3D pipeline.

Usage:
    blender --background --python assemble.py -- <traits.json> <out.glb>

traits.json shape (subset of KitbashTraits that affects geometry):
    {
      "tokenId": "123",
      "frameType": "Heavy Armor",
      "head": "Twin Horn",
      "primaryWeapon": "Beam Rifle",
      "backpack": "Flight Unit",
      "colorway": "Federation White & Blue",
      "special": "Trans-Am burst (red energy aura)"
    }

Builds a placeholder mecha from primitives (see lib/components.py for why),
exports a single GLB with the whole rig parented under one empty named
"GundarFrame_<tokenId>", and exits. Every step here is a real, working
build+export — swapping the placeholder geometry for hand-modeled assets
later only touches lib/components.py, not this orchestration.
"""

import json
import os
import sys

import bpy

# Blender doesn't put the script's own directory on sys.path automatically
# when run via --python, so `from lib import components` would fail without
# this.
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)

from lib import components  # noqa: E402


def _parse_args():
    argv = sys.argv
    if "--" not in argv:
        raise SystemExit("Usage: blender --background --python assemble.py -- <traits.json> <out.glb>")
    rest = argv[argv.index("--") + 1:]
    if len(rest) != 2:
        raise SystemExit("Expected exactly 2 args after '--': <traits.json> <out.glb>")
    return rest[0], rest[1]


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def assemble(traits: dict):
    token_id = traits.get("tokenId", "0")
    group_name = f"GundarFrame_{token_id}"

    frame_objs, sockets = components.build_frame(traits["frameType"], group_name)
    head_objs = components.build_head(traits["head"], sockets["head"], group_name)
    weapon_objs = components.build_weapon(traits["primaryWeapon"], sockets["hand"], group_name)
    backpack_objs = components.build_backpack(traits["backpack"], sockets["back"], group_name)
    special_objs = components.apply_special(
        traits.get("special", "None"), sockets["head"], group_name
    )

    geometry_objs = frame_objs + head_objs + weapon_objs + backpack_objs
    components.apply_materials(geometry_objs, traits["colorway"], group_name)

    all_objs = geometry_objs + special_objs

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    root = bpy.context.active_object
    root.name = group_name
    for obj in all_objs:
        obj.parent = root

    return root


def export_glb(root, out_path: str):
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in [root] + list(root.children_recursive):
        obj.select_set(True)
    root.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
    )


def main():
    traits_path, out_path = _parse_args()
    with open(traits_path) as f:
        traits = json.load(f)

    reset_scene()
    root = assemble(traits)
    export_glb(root, out_path)
    print(f"OK wrote {out_path}")


if __name__ == "__main__":
    main()
