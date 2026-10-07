import type { Material } from "@babylonjs/core/Materials/material";
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";

/**
 * Blends a sprite toward pure white for the impact flash (plan 233). The unlit emissive tint only
 * multiplies the texture down (dim, KO grey) — it can never brighten it past its own colours — so
 * the white flash is a final-colour mix driven by a uniform: toggling it never recompiles the shader.
 */
export class SpriteFlashPlugin extends MaterialPluginBase {
  /** 0 = untouched, 1 = solid white silhouette. */
  whiteLevel = 0;

  constructor(material: Material) {
    super(material, "SpriteFlash", 201, { SPRITE_FLASH: true });
    this._enable(true);
  }

  override getClassName(): string {
    return "SpriteFlashPlugin";
  }

  override prepareDefines(defines: Record<string, unknown>): void {
    defines.SPRITE_FLASH = true;
  }

  override getUniforms(): {
    ubo: { name: string; size: number; type: string }[];
    fragment: string;
  } {
    return {
      ubo: [{ name: "spriteWhiteLevel", size: 1, type: "float" }],
      fragment: `#ifdef SPRITE_FLASH
        uniform float spriteWhiteLevel;
      #endif`,
    };
  }

  override bindForSubMesh(uniformBuffer: UniformBuffer): void {
    uniformBuffer.updateFloat("spriteWhiteLevel", this.whiteLevel);
  }

  override getCustomCode(shaderType: string): Record<string, string> | null {
    if (shaderType !== "fragment") {
      return null;
    }
    return {
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `#ifdef SPRITE_FLASH
        color.rgb = mix(color.rgb, vec3(1.0), spriteWhiteLevel);
      #endif`,
    };
  }
}
