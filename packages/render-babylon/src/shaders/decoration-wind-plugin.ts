import type { MaterialDefines } from "@babylonjs/core/Materials/materialDefines";
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";

/**
 * Height-weighted wind for a decoration material (tree / tall-grass). A `StandardMaterial` plugin that
 * displaces each vertex horizontally in the vertex shader by `amplitude × weight`, where `weight` ramps
 * 0→1 from the model's floor (`baseY`) to its top (`baseY + heightRange`): the base is pinned
 * (trunk/roots/grass foot never move, nothing dips under the map) and only the top sways. The throw is
 * offset per vertex by its world XZ so a field ripples, and driven by `time` (advanced each frame by the
 * scene). Runs on the GPU, shared by every clone of the template, and leaves the vertex colours untouched.
 *
 * `time` is expected to be the phase in radians wrapped to `[0, 2π)`; both the X and Z throws are the
 * SAME frequency as that phase (sin / cos of `time + phase`), so they stay continuous across the wrap —
 * a non-integer frequency multiple would jump when `time` resets and the loop would visibly hitch.
 *
 * Injected at `CUSTOM_VERTEX_UPDATE_POSITION`, which runs BEFORE the instances include defines
 * `finalWorld` — hence the phase uses the plain `world` uniform (fine: clones are regular meshes, not
 * hardware instances).
 */
export class DecorationWindPlugin extends MaterialPluginBase {
  time = 0;
  private readonly amplitude: number;
  private readonly baseY: number;
  private readonly heightRange: number;

  constructor(material: StandardMaterial, amplitude: number, baseY: number, heightRange: number) {
    // The plugin is enabled for its whole lifetime (only attached to tree/grass materials), so the
    // define is always on — no runtime toggle.
    super(material, "DecorationWind", 200, { DECORATION_WIND: true });
    this.amplitude = amplitude;
    this.baseY = baseY;
    this.heightRange = Math.max(1e-4, heightRange);
    this._enable(true);
  }

  getClassName(): string {
    return "DecorationWindPlugin";
  }

  prepareDefines(defines: MaterialDefines): void {
    defines.DECORATION_WIND = true;
  }

  getUniforms(): { ubo: { name: string; size: number; type: string }[]; vertex: string } {
    return {
      ubo: [{ name: "windParams", size: 4, type: "vec4" }],
      vertex: `#ifdef DECORATION_WIND
uniform vec4 windParams;
#endif`,
    };
  }

  bindForSubMesh(uniformBuffer: UniformBuffer): void {
    uniformBuffer.updateFloat4(
      "windParams",
      this.time,
      this.amplitude,
      this.baseY,
      this.heightRange,
    );
  }

  getCustomCode(shaderType: string): Record<string, string> | null {
    if (shaderType !== "vertex") {
      return null;
    }
    return {
      CUSTOM_VERTEX_UPDATE_POSITION: `#ifdef DECORATION_WIND
        float windWeight = clamp((positionUpdated.y - windParams.z) / windParams.w, 0.0, 1.0);
        windWeight *= windWeight;
        vec3 windWorld = (world * vec4(positionUpdated, 1.0)).xyz;
        float windPhase = windWorld.x * 0.9 + windWorld.z * 0.7;
        positionUpdated.x += windParams.y * windWeight * sin(windParams.x + windPhase);
        positionUpdated.z += windParams.y * windWeight * 0.5 * cos(windParams.x + windPhase);
      #endif`,
    };
  }
}
