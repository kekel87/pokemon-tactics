import type { MaterialDefines } from "@babylonjs/core/Materials/materialDefines";
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import {
  BABYLON_LIQUID_SURFACE_PIXELS_PER_UNIT,
  type LiquidShimmerParams,
} from "../babylon-constants.js";

/**
 * Subtle "life" for a liquid SURFACE material (2026-07-23). A `StandardMaterial` plugin that
 * animates the surface over its static texture — NOT palette-cycling nor frame animation (the
 * PMD source rips carry no animation frames; see `docs/tileset-mapping.md` § Provenance). Three
 * synthesised, per-liquid-tunable effects, all driven by `time` (seconds) and the fragment's
 * world XZ (`vLiquidWorldXZ`, computed in the vertex stage — a self-supplied varying, since
 * StandardMaterial drops `vPositionW` when lighting is disabled, which liquids do):
 *
 * - **Bubble blobs** (`blob`, signed): localized patches of a smooth animated 2D field brighten
 *   (`> 0`, lava) or darken (`< 0`, swamp) — moving "bubbles", not a gradient sweeping the pool.
 * - **Sparkle wave** (`sparkle`): a travelling thin bright band + twinkling glints — a shimmer
 *   wave crossing the water.
 * - **Ripple** (`ripple`): a tiny vertical bob of the TOP face vertices (a unit box has local y
 *   at ±0.5, so gating on `positionUpdated.y > 0.0` moves only the top ring — floor stays pinned,
 *   no gaps under the map).
 *
 * Injected at `CUSTOM_VERTEX_UPDATE_POSITION` (has `positionUpdated` + the `world` uniform) and
 * `CUSTOM_FRAGMENT_MAIN_END` (has `gl_FragColor` set).
 */
export class LiquidShimmerPlugin extends MaterialPluginBase {
  time = 0;
  private readonly params: LiquidShimmerParams;

  constructor(material: StandardMaterial, params: LiquidShimmerParams) {
    // Attached only to liquid surface materials for their whole lifetime → define always on.
    // Priority 210 runs after StandardMaterial's built-in plugins (and after the decoration
    // wind plugin at 200), so it composes on top of the base shading.
    super(material, "LiquidShimmer", 210, { LIQUID_SHIMMER: true });
    this.params = params;
    this._enable(true);
  }

  getClassName(): string {
    return "LiquidShimmerPlugin";
  }

  prepareDefines(defines: MaterialDefines): void {
    defines.LIQUID_SHIMMER = true;
  }

  getUniforms(): {
    ubo: { name: string; size: number; type: string }[];
    vertex: string;
    fragment: string;
  } {
    return {
      ubo: [
        { name: "liquidVertex", size: 4, type: "vec4" },
        { name: "liquidBlob", size: 4, type: "vec4" },
        { name: "liquidSparkle", size: 4, type: "vec4" },
        { name: "liquidFlow", size: 4, type: "vec4" },
      ],
      vertex: `#ifdef LIQUID_SHIMMER
uniform vec4 liquidVertex; // (time, ripple, rippleSpeed, phaseFreq)
#endif`,
      fragment: `#ifdef LIQUID_SHIMMER
uniform vec4 liquidBlob;    // (time, blobAmount, blobScale, blobSpeed)
uniform vec4 liquidSparkle; // (sparkleAmount, sparkleScale, sparkleSpeed, pixelsPerUnit)
uniform vec4 liquidFlow;    // (flowX, flowZ, blobDrift, patternMode) — world-XZ flow + blob mode
#endif`,
    };
  }

  bindForSubMesh(uniformBuffer: UniformBuffer): void {
    const p = this.params;
    uniformBuffer.updateFloat4("liquidVertex", this.time, p.ripple, p.rippleSpeed, p.phaseFreq);
    uniformBuffer.updateFloat4("liquidBlob", this.time, p.blob, p.blobScale, p.blobSpeed);
    uniformBuffer.updateFloat4(
      "liquidSparkle",
      p.sparkle,
      p.sparkleScale,
      p.sparkleSpeed,
      BABYLON_LIQUID_SURFACE_PIXELS_PER_UNIT,
    );
    uniformBuffer.updateFloat4("liquidFlow", p.flowX, p.flowZ, p.blobDrift, p.blobPatternCycle);
  }

  getCustomCode(shaderType: string): Record<string, string> | null {
    if (shaderType === "vertex") {
      return {
        CUSTOM_VERTEX_DEFINITIONS: `#ifdef LIQUID_SHIMMER
varying vec2 vLiquidWorldXZ;
#endif`,
        CUSTOM_VERTEX_UPDATE_POSITION: `#ifdef LIQUID_SHIMMER
        vec3 lqWorld = (world * vec4(positionUpdated, 1.0)).xyz;
        vLiquidWorldXZ = lqWorld.xz;
        if (positionUpdated.y > 0.0) {
          float lqPhase = lqWorld.x * liquidVertex.w + lqWorld.z * liquidVertex.w * 0.8;
          positionUpdated.y += liquidVertex.y * sin(liquidVertex.x * liquidVertex.z + lqPhase);
        }
      #endif`,
      };
    }
    if (shaderType === "fragment") {
      return {
        CUSTOM_FRAGMENT_DEFINITIONS: `#ifdef LIQUID_SHIMMER
varying vec2 vLiquidWorldXZ;
float lqHash(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
float lqStaticField(vec2 p, float s) {
  return sin(p.x * s) * sin(p.y * s * 0.9) + 0.5 * sin((p.x + p.y) * s * 1.7);
}
#endif`,
        CUSTOM_FRAGMENT_MAIN_END: `#ifdef LIQUID_SHIMMER
        float lqT = liquidBlob.x;
        vec2 lqFlow = liquidFlow.xy; // world-XZ flow direction, East is +Z (direction-arrow-layout)
        // Pixel-perfect: snap the world-XZ sampling to the texture texel grid (pixelsPerUnit) so the
        // effects render as chunky pixel-art cells aligned to the texture, not smooth gradients.
        float lqPpu = liquidSparkle.w;
        vec2 lqPix = floor(vLiquidWorldXZ * lqPpu) / lqPpu;
        // Bubble blobs, signed amount (lava brightens, swamp darkens). Two modes via liquidFlow.w:
        float lqScale = liquidBlob.z;
        float lqBlob;
        if (liquidFlow.w > 0.5) {
          // Static pattern-cycle (swamp): three fixed dark-zone layouts, no drift. Slow cosine
          // weights (120 deg apart) cross-fade between them, so zones appear/disappear in place.
          float lqCyc = lqT * liquidBlob.w;
          float lqW0 = 0.5 + 0.5 * cos(lqCyc);
          float lqW1 = 0.5 + 0.5 * cos(lqCyc - 2.0944);
          float lqW2 = 0.5 + 0.5 * cos(lqCyc - 4.1888);
          // High threshold → small, distinct spots (only field peaks), so the three layouts
          // barely overlap and each visibly fades in/out instead of summing to a constant.
          float lqM0 = smoothstep(0.55, 1.3, lqStaticField(lqPix, lqScale));
          float lqM1 = smoothstep(0.55, 1.3, lqStaticField(lqPix + vec2(13.7, 4.2), lqScale));
          float lqM2 = smoothstep(0.55, 1.3, lqStaticField(lqPix + vec2(6.1, 19.3), lqScale));
          lqBlob = liquidBlob.y * (lqM0 * lqW0 + lqM1 * lqW1 + lqM2 * lqW2);
        } else {
          // Churn (lava): field with internal time so bubbles pop, plus optional flow advection.
          // Snap the (optionally advected) coord too so the pattern stays texel-aligned.
          vec2 lqQ = floor((vLiquidWorldXZ - lqFlow * (lqT * liquidFlow.z)) * lqPpu) / lqPpu;
          float lqField = sin(lqQ.x * lqScale + lqT * liquidBlob.w)
                        * sin(lqQ.y * lqScale * 0.9 - lqT * liquidBlob.w * 0.7)
                        + 0.5 * sin((lqQ.x + lqQ.y) * lqScale * 1.7 + lqT * liquidBlob.w * 1.3);
          lqBlob = liquidBlob.y * smoothstep(0.15, 1.1, lqField);
        }
        // Sparkle wave: a travelling bright band (along the flow) + sparse twinkling glints.
        float lqSc = liquidSparkle.y;
        float lqWave = sin(dot(lqPix, lqFlow) * lqSc - lqT * liquidSparkle.z);
        float lqBand = smoothstep(0.7, 1.0, lqWave);
        vec2 lqCell = floor(lqPix * lqSc * 2.0) + floor(lqT * 3.0);
        float lqTwinkle = step(0.86, lqHash(lqCell));
        float lqSparkle = liquidSparkle.x * (lqBand * 0.6 + lqTwinkle * 0.4);
        gl_FragColor.rgb *= 1.0 + lqBlob + lqSparkle;
      #endif`,
      };
    }
    return null;
  }
}
