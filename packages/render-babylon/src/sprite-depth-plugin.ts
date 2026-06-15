import type { Material } from "@babylonjs/core/Materials/material";
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";

/**
 * Flattens a billboard sprite's depth to a single value (its ground/foot point)
 * so the upright plane occludes terrain like a flat token standing on its tile,
 * instead of writing per-pixel depth that lets the tile cube it sits in front of
 * bury its lower body (the classic 2.5D billboard self-clip). The foot's NDC
 * depth is computed CPU-side each frame (cheap in ortho) and written verbatim to
 * `gl_FragDepth`, so a taller tile genuinely in front still occludes the sprite,
 * but its own tile / shadow / equal-height neighbours never do.
 *
 * Technique: see `docs/references/babylon-gotchas.md` (billboard depth) — based on
 * the bgolus depth-offset approach for HD-2D sprites.
 */
export class SpriteDepthPlugin extends MaterialPluginBase {
  /** Foot point depth in [0, 1] (window-space), set per frame from the CPU. */
  footDepth = 0.5;

  constructor(material: Material) {
    super(material, "SpriteDepth", 200, { SPRITE_DEPTH: true });
    this._enable(true);
  }

  override getClassName(): string {
    return "SpriteDepthPlugin";
  }

  override prepareDefines(defines: Record<string, unknown>): void {
    defines.SPRITE_DEPTH = true;
  }

  override getUniforms(): {
    ubo: { name: string; size: number; type: string }[];
    fragment: string;
  } {
    return {
      ubo: [{ name: "spriteFootDepth", size: 1, type: "float" }],
      fragment: `#ifdef SPRITE_DEPTH
        uniform float spriteFootDepth;
      #endif`,
    };
  }

  override bindForSubMesh(uniformBuffer: UniformBuffer): void {
    uniformBuffer.updateFloat("spriteFootDepth", this.footDepth);
  }

  override getCustomCode(shaderType: string): Record<string, string> | null {
    if (shaderType !== "fragment") {
      return null;
    }
    return {
      // After the colour + alpha-test discard: stamp the whole sprite at its
      // foot depth so it depth-sorts as a flat token on its tile.
      CUSTOM_FRAGMENT_MAIN_END: `#ifdef SPRITE_DEPTH
        gl_FragDepth = spriteFootDepth;
      #endif`,
    };
  }
}
