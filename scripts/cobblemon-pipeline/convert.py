"""Bedrock .geo.json -> GLB (plan 129, temps 3, etape 3-4).

Blender headless + mcblend. mcblend imports the geometry as an armature + per-cube
meshes; we assign the Cobblemon texture (pixel-art, alpha clip), apply the baked Molang
keyframes (optional) onto the armature, and export an animated GLB.

The baked JSON (from bake-molang.ts) holds pure keyframes per clip/bone/channel. Bedrock
bone animation values are a delta from the bind pose expressed in the bone's own pivot
frame — which is exactly Blender's `pose_bone.matrix_basis`. So we invert mcblend's own
Blender->Bedrock conversion (operator_func/common.py get_mcrotation + animation.py
load_poses) to go Bedrock->Blender:
    rotation (deg): blender euler XZY = (bx, bz, -by)   [mcblend does bedrock = euler[[0,2,1]]*(1,-1,1)]
    position (px):  blender loc       = (lx, lz, ly)/16 [mcblend does bedrock = trans[[0,2,1]]*16]
    scale:          blender scale     = (sx, sz, sy)    [mcblend does bedrock = scale[[0,2,1]]]
This is exact for the common case where Bedrock bones carry a pivot but no rest rotation.

Each clip becomes an NLA track (named by its short clip name) so the glTF exporter emits
one named animation per clip -> Babylon AnimationGroups.

Run: blender -b --python convert.py -- <geo.json> <texture.png> <out.glb> [baked.json] [fps]
"""

import json
import math
import sys

import addon_utils
import bpy

DEFAULT_FPS = 30


def parse_args():
    argv = sys.argv
    if "--" not in argv:
        raise SystemExit(
            "usage: blender -b --python convert.py -- <geo> <texture> <out.glb> [baked.json] [fps]"
        )
    rest = argv[argv.index("--") + 1:]
    geo, texture, out_glb = rest[0], rest[1], rest[2]
    baked = rest[3] if len(rest) > 3 else None
    fps = int(rest[4]) if len(rest) > 4 else DEFAULT_FPS
    return geo, texture, out_glb, baked, fps


# Depth nudge (Bedrock px, 1px = 1/16 block) between *overlapping* coplanar membranes.
# Enough to beat depth precision, tiny in world (≈0.5px × scale); applied only within a
# cluster of cubes that actually overlap, so the spread stays a few tenths of a pixel.
COPLANAR_NUDGE_PX = 0.5


def _intervals_overlap(a_min, a_size, b_min, b_size):
    return a_min < b_min + b_size and b_min < a_min + a_size


def _stagger_coplanar(flat_cubes):
    """flat_cubes: list of (origin, size, flat_axis) all on one (axis, plane). Cluster the
    ones that overlap in the plane and push each cluster member off the shared plane by a
    growing epsilon, so z-fighting membranes get distinct depths. Returns count nudged."""
    plane_axes = [(1, 2), (0, 2), (0, 1)]
    nudged = 0
    handled = [False] * len(flat_cubes)
    for i, (origin_i, size_i, axis) in enumerate(flat_cubes):
        if handled[i]:
            continue
        ax_a, ax_b = plane_axes[axis]
        cluster = [i]
        for j in range(i + 1, len(flat_cubes)):
            origin_j, size_j, _ = flat_cubes[j]
            if handled[j] or not (
                _intervals_overlap(origin_i[ax_a], size_i[ax_a], origin_j[ax_a], size_j[ax_a])
                and _intervals_overlap(origin_i[ax_b], size_i[ax_b], origin_j[ax_b], size_j[ax_b])
            ):
                continue
            cluster.append(j)
            handled[j] = True
        handled[i] = True
        for depth, index in enumerate(cluster):
            if depth > 0:
                flat_cubes[index][0][axis] += COPLANAR_NUDGE_PX * depth
                nudged += 1
    return nudged


def preprocess_geo(geo_path):
    """Stop Cobblemon wing/fin membranes z-fighting in a plain renderer, two ways that
    mirror how Minecraft avoids it natively:

    1. Drop cubes of `*_hidden` bones — alternate membranes Cobblemon swaps in for other
       states (folded vs spread wing). They sit on the exact plane of their visible twin;
       MC never shows both at once (a render controller toggles visibility) while our
       converter renders every cube. The bone stays (hierarchy + animation targets); only
       its geometry goes.
    2. Stagger flat (zero-thickness) cubes that share a plane AND overlap (the membrane tiled
       across several wing-segment bones, all at the same local z because Bedrock bones are
       pivot-only) — push overlapping ones off the plane by a tiny epsilon. MC separates these
       via per-segment `inflate` + draw order; the nudge is the same idea, scoped to actually-
       overlapping clusters so nothing visibly detaches.

    Returns a filtered geo path, or the original when nothing matched.
    """
    with open(geo_path, encoding="utf8") as handle:
        data = json.load(handle)
    stripped = 0
    nudged = 0
    for geometry in data.get("minecraft:geometry", []):
        planes: dict = {}
        for bone in geometry.get("bones", []):
            if "hidden" in bone.get("name", "").lower() and bone.get("cubes"):
                bone["cubes"] = []
                stripped += 1
                continue
            for cube in bone.get("cubes", []):
                size = cube.get("size", [0, 0, 0])
                origin = cube.get("origin")
                if origin is None or all(dimension != 0 for dimension in size):
                    continue
                flat_axis = size.index(0)
                planes.setdefault((flat_axis, round(origin[flat_axis], 2)), []).append(
                    (origin, size, flat_axis)
                )
        for flat_cubes in planes.values():
            nudged += _stagger_coplanar(flat_cubes)
    if stripped == 0 and nudged == 0:
        return geo_path
    out_path = geo_path + ".filtered.json"
    with open(out_path, "w", encoding="utf8") as handle:
        json.dump(data, handle)
    print(f"preprocess: stripped {stripped} hidden bone(s), nudged {nudged} coplanar membrane(s)")
    return out_path


def clear_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def make_pixel_material(texture_path):
    image = bpy.data.images.load(texture_path)
    image.alpha_mode = "CHANNEL_PACKED"
    material = bpy.data.materials.new("cobblemon")
    material.use_nodes = True
    material.blend_method = "CLIP"  # cutout alpha, pixel-art
    tree = material.node_tree
    bsdf = tree.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Specular IOR Level"].default_value = 0.0
    tex_node = tree.nodes.new("ShaderNodeTexImage")
    tex_node.image = image
    tex_node.interpolation = "Closest"  # nearest sampling
    tree.links.new(bsdf.inputs["Base Color"], tex_node.outputs["Color"])
    tree.links.new(bsdf.inputs["Alpha"], tex_node.outputs["Alpha"])
    return material


def find_armature():
    for obj in bpy.data.objects:
        if obj.type == "ARMATURE":
            return obj
    raise SystemExit("no armature produced by mcblend import")


def short_clip_name(clip_name):
    # "animation.venusaur.ground_idle" -> "ground_idle"
    return clip_name.rsplit(".", 1)[-1]


def apply_channel(pose_bone, channel, keyframes, fps, action):
    if channel == "rotation":
        data_path, convert = "rotation_euler", lambda v: (
            math.radians(v[0]), math.radians(v[2]), math.radians(-v[1])
        )
    elif channel == "position":
        data_path, convert = "location", lambda v: (v[0] / 16.0, v[2] / 16.0, v[1] / 16.0)
    elif channel == "scale":
        data_path, convert = "scale", lambda v: (v[0], v[2], v[1])
    else:
        return
    for keyframe in keyframes:
        setattr(pose_bone, data_path, convert(keyframe["value"]))
        pose_bone.keyframe_insert(data_path=data_path, frame=keyframe["time"] * fps + 1.0)


def apply_animations(armature, baked_path, fps):
    with open(baked_path, encoding="utf8") as handle:
        baked = json.load(handle)
    bpy.context.scene.render.fps = fps
    armature.animation_data_create()
    for pose_bone in armature.pose.bones:
        pose_bone.rotation_mode = "XZY"

    applied = []
    for clip_name, clip in baked.items():
        short = short_clip_name(clip_name)
        action = bpy.data.actions.new(name=short)
        armature.animation_data.action = action
        bone_count = 0
        for bone_name, channels in clip["bones"].items():
            pose_bone = armature.pose.bones.get(bone_name)
            if pose_bone is None:
                continue
            bone_count += 1
            for channel, keyframes in channels.items():
                apply_channel(pose_bone, channel, keyframes, fps, action)
        # Park the action on its own NLA track so the glTF exporter emits one named
        # animation per clip (export_animation_mode NLA_TRACKS).
        track = armature.animation_data.nla_tracks.new()
        track.name = short
        track.strips.new(short, 1, action)
        armature.animation_data.action = None
        applied.append((short, bone_count, len(clip["bones"])))

    for short, matched, total in applied:
        print(f"  clip {short}: {matched}/{total} bones")
    print(f"applied {len(applied)} clips")


def main():
    geo, texture, out_glb, baked, fps = parse_args()
    addon_utils.enable("mcblend", default_set=True)
    clear_scene()

    bpy.ops.mcblend.import_model(filepath=preprocess_geo(geo))

    material = make_pixel_material(texture)
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            obj.data.materials.clear()
            obj.data.materials.append(material)

    export_kwargs = dict(
        filepath=out_glb,
        export_format="GLB",
        export_apply=False,
        export_yup=True,
    )
    if baked:
        armature = find_armature()
        apply_animations(armature, baked, fps)
        export_kwargs["export_animations"] = True
        export_kwargs["export_animation_mode"] = "NLA_TRACKS"

    bpy.ops.export_scene.gltf(**export_kwargs)
    print("GLB_WRITTEN:", out_glb)


main()
