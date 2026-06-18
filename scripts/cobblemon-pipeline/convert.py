"""Bedrock .geo.json -> GLB (plan 129, temps 3, etape 3-4).

Blender headless + mcblend. mcblend imports the geometry as an armature + per-cube
meshes; we assign the Cobblemon texture (pixel-art, alpha clip) and export a GLB.

v1: static mesh + texture only (no animation) — validates mesh/texture/scale first.
Animations (from the baked Molang JSON) come in v2.

Run: blender --background --python convert.py -- <geo.json> <texture.png> <out.glb>
"""

import sys

import addon_utils
import bpy


def parse_args():
    argv = sys.argv
    if "--" not in argv:
        raise SystemExit("usage: blender -b --python convert.py -- <geo> <texture> <out.glb>")
    geo, texture, out_glb = argv[argv.index("--") + 1:]
    return geo, texture, out_glb


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


def main():
    geo, texture, out_glb = parse_args()
    addon_utils.enable("mcblend", default_set=True)
    clear_scene()

    bpy.ops.mcblend.import_model(filepath=geo)

    material = make_pixel_material(texture)
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            obj.data.materials.clear()
            obj.data.materials.append(material)

    bpy.ops.export_scene.gltf(
        filepath=out_glb,
        export_format="GLB",
        export_apply=False,
        export_yup=True,
    )
    print("GLB_WRITTEN:", out_glb)


main()
