"""
Procedural battle-move animations for GundariuM Gundar-Frames.

No armature/rig exists (see components.py's docstring — the geometry itself
is placeholder primitives). These animations work entirely by keyframing the
existing objects assemble.py already builds: the weapon object build_weapon()
returns, plus the root empty everything is parented under. Blender's glTF
exporter bakes each Blender Action into a separate named animation clip in
the GLB when export_animation_mode="ACTIONS" — <model-viewer> can select and
play any of them by name at runtime via its animation-name attribute / JS API.

Archetype, not per-weapon-name, is what actually gets keyframed — but the
CLASSIFICATION into an archetype is per real weapon name (weapon_archetype_for
below), reusing the same keyword rules build_weapon() already uses to choose
a shape. That's what makes this "per-weapon-name" in the sense that matters:
a Beam Rifle and a Heat Hawk provably resolve to different, real motion,
even though weapons sharing an archetype (e.g. Beam Rifle / Beam Cannon /
GN Sniper Rifle) share a clip. A fully bespoke clip per one of the ~37 names
would be real 3D-animator work this pipeline has no artist for — this is the
honest, procedurally-generatable version of "as much detail as possible."

Transform keyframes only (location/rotation/scale) — material property
animation (e.g. an emission-strength "muzzle flash") was tried and dropped:
keyframing a BSDF input creates animation data on the material's node tree,
a completely separate ID from the object, which this module wasn't managing.
The stray, never-keyframed object-level action that resulted had no Action
Slot, and Blender 5.0's exporter hard-crashes (AttributeError on
strip.action_slot.target_id_type) trying to export an NLA strip whose action
has no slot. Whether Blender's glTF exporter can even carry material
animation into a clip at all is unconfirmed — not worth the crash risk this
close to launch. Revisit post-launch if the swing/recoil/lunge motion alone
doesn't sell it.
"""

import bpy


# ─── Weapon name -> archetype ────────────────────────────────────────
# Mirrors build_weapon()'s own keyword classification in components.py —
# same weapon name should resolve to a shape AND a motion that agree with
# each other (a blade-shaped weapon should swing, not recoil).

def weapon_archetype_for(weapon_name: str) -> str:
    lower = weapon_name.lower()
    if any(k in lower for k in ("sword", "blade", "hawk", "katana", "shotel", "sabe", "naginata", "halberd", "pile bunker")):
        return "blade"
    if any(k in lower for k in ("bazooka", "launcher")):
        return "heavy"
    if any(k in lower for k in ("machine gun", "gatling", "tactical arms")):
        return "rapid"
    if any(k in lower for k in ("funnel", "dragoon", "bit")):
        return "remote"
    if any(k in lower for k in ("rifle", "cannon", "gun", "carbine", "sniper", "magnum")):
        return "beam"
    return "beam"  # unclassified weapon names still get a real, sensible default


ARCHETYPES = ("blade", "beam", "heavy", "rapid", "remote", "special")


# ─── Keyframe helpers ─────────────────────────────────────────────────

def _key_loc(obj, frame):
    obj.keyframe_insert(data_path="location", frame=frame)


def _key_rot(obj, frame):
    obj.keyframe_insert(data_path="rotation_euler", frame=frame)


def _key_scale(obj, frame):
    obj.keyframe_insert(data_path="scale", frame=frame)


def _new_action(obj, name):
    if obj.animation_data is None:
        obj.animation_data_create()
    action = bpy.data.actions.new(name=name)
    obj.animation_data.action = action
    return action


def _stash_to_nla(obj):
    # The same weapon object gets a fresh action baked onto it once per
    # archetype (primary/secondary/tertiary can all point at the same prop,
    # since only one weapon is actually modeled). Each new assignment to
    # animation_data.action overwrites the previous one — fake_user keeps the
    # action's data alive but does NOT make Blender's glTF exporter's
    # export_animation_mode="ACTIONS" find it, since that mode discovers
    # actions via NLA strips, not orphaned-but-undeleted action datablocks.
    # Pushing each action onto its own NLA track+strip immediately after
    # baking it is what actually makes every one of them exportable.
    # (Confirmed by testing: without this, a 4-action bake on one shared
    # object only exported 2 of the 4 clips.)
    #
    # Only call this on an object that actually received a real
    # keyframe_insert() in this action — an action with zero keyframes has
    # no Action Slot, and stashing a slotless action crashes the exporter.
    action = obj.animation_data.action
    track = obj.animation_data.nla_tracks.new()
    track.name = action.name
    track.strips.new(action.name, start=1, action=action)
    obj.animation_data.action = None
    action.use_fake_user = True


# ─── Archetype motions ─────────────────────────────────────────────────
# Each takes (root, weapon_objs, action_name) and returns nothing — it
# keyframes root and/or the weapon object(s) directly. Frame range is
# always 1-24 (1 second at 24fps), matching FPS set in bake_move_animations.

def _anim_blade(root, weapon_objs, action_name):
    if not weapon_objs:
        return
    weapon = weapon_objs[0]
    base_rot = tuple(weapon.rotation_euler)
    _new_action(weapon, action_name)
    _key_rot(weapon, 1)
    weapon.rotation_euler = (base_rot[0] - 0.9, base_rot[1], base_rot[2] + 0.3)
    _key_rot(weapon, 6)
    weapon.rotation_euler = (base_rot[0] + 0.6, base_rot[1], base_rot[2] - 0.5)
    _key_rot(weapon, 12)
    weapon.rotation_euler = base_rot
    _key_rot(weapon, 20)
    _stash_to_nla(weapon)

    # A lunge sells a melee hit better than a swing alone.
    base_loc = tuple(root.location)
    _new_action(root, f"{action_name}_root")
    _key_loc(root, 1)
    root.location = (base_loc[0], base_loc[1] - 0.25, base_loc[2])
    _key_loc(root, 8)
    root.location = base_loc
    _key_loc(root, 20)
    _stash_to_nla(root)


def _anim_beam(root, weapon_objs, action_name):
    if not weapon_objs:
        return
    weapon = weapon_objs[0]
    base_loc = tuple(weapon.location)
    _new_action(weapon, action_name)
    _key_loc(weapon, 1)
    weapon.location = (base_loc[0], base_loc[1] + 0.08, base_loc[2])
    _key_loc(weapon, 4)
    weapon.location = base_loc
    _key_loc(weapon, 10)
    _stash_to_nla(weapon)


def _anim_heavy(root, weapon_objs, action_name):
    if not weapon_objs:
        return
    weapon = weapon_objs[0]
    base_loc = tuple(weapon.location)
    _new_action(weapon, action_name)
    _key_loc(weapon, 1)
    weapon.location = (base_loc[0], base_loc[1] + 0.22, base_loc[2])
    _key_loc(weapon, 5)
    weapon.location = base_loc
    _key_loc(weapon, 16)
    _stash_to_nla(weapon)

    base_rot = tuple(root.rotation_euler)
    _new_action(root, f"{action_name}_root")
    _key_rot(root, 1)
    root.rotation_euler = (base_rot[0], base_rot[1], base_rot[2] + 0.08)
    _key_rot(root, 5)
    root.rotation_euler = base_rot
    _key_rot(root, 18)
    _stash_to_nla(root)


def _anim_rapid(root, weapon_objs, action_name):
    if not weapon_objs:
        return
    weapon = weapon_objs[0]
    base_loc = tuple(weapon.location)
    _new_action(weapon, action_name)
    _key_loc(weapon, 1)
    jitter_frames = (3, 6, 9, 12, 15, 18)
    for i, f in enumerate(jitter_frames):
        offset = 0.03 if i % 2 == 0 else -0.03
        weapon.location = (base_loc[0] + offset, base_loc[1] + 0.04, base_loc[2])
        _key_loc(weapon, f)
    weapon.location = base_loc
    _key_loc(weapon, 22)
    _stash_to_nla(weapon)


def _anim_remote(root, weapon_objs, action_name):
    # No separate funnel/bit geometry exists yet (build_weapon returns one
    # object for every weapon name) — approximate with the weapon object
    # floating/orbiting outward rather than recoiling, distinct enough from
    # beam/heavy to read as "deployed remote units," honest about the
    # geometry limit rather than pretending funnels detach.
    if not weapon_objs:
        return
    weapon = weapon_objs[0]
    base_loc = tuple(weapon.location)
    _new_action(weapon, action_name)
    _key_loc(weapon, 1)
    weapon.location = (base_loc[0] + 0.3, base_loc[1] + 0.15, base_loc[2] + 0.2)
    _key_loc(weapon, 10)
    weapon.location = base_loc
    _key_loc(weapon, 22)
    _stash_to_nla(weapon)


def _anim_special(root, special_objs, action_name):
    base_scale = tuple(root.scale)
    _new_action(root, action_name)
    _key_scale(root, 1)
    root.scale = (base_scale[0] * 1.08, base_scale[1] * 1.08, base_scale[2] * 1.08)
    _key_scale(root, 8)
    root.scale = base_scale
    _key_scale(root, 20)
    _stash_to_nla(root)

    # special_objs (e.g. the Trans-Am aura disc) get a matching scale pulse
    # of their own so the effect object itself grows with the flash, not
    # just the whole model — still transform-only, still safe to export.
    for obj in special_objs:
        base = tuple(obj.scale)
        _new_action(obj, f"{action_name}_fx_{obj.name}")
        _key_scale(obj, 1)
        obj.scale = (base[0] * 1.6, base[1] * 1.6, base[2] * 1.6)
        _key_scale(obj, 8)
        obj.scale = base
        _key_scale(obj, 20)
        _stash_to_nla(obj)


_ANIM_FUNCS = {
    "blade": _anim_blade,
    "beam": _anim_beam,
    "heavy": _anim_heavy,
    "rapid": _anim_rapid,
    "remote": _anim_remote,
}


def bake_move_animations(root, weapon_objs, special_objs, weapon_names_by_slot: dict):
    """
    weapon_names_by_slot: {"primary": "...", "secondary": "...", "tertiary": "..."}
    Bakes one action per slot actually present, named "<slot>_attack" for the
    frontend to select by exact move, plus "special_attack" using
    apply_special's own VFX objects when any exist. Returns the list of
    action names created, for the caller to log/verify.
    """
    bpy.context.scene.render.fps = 24
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 24

    created = []
    for slot in ("primary", "secondary", "tertiary"):
        weapon_name = weapon_names_by_slot.get(slot)
        if not weapon_name:
            continue
        archetype = weapon_archetype_for(weapon_name)
        action_name = f"{slot}_attack"
        _ANIM_FUNCS[archetype](root, weapon_objs, action_name)
        created.append(action_name)

    _anim_special(root, special_objs, "special_attack")
    created.append("special_attack")

    return created
