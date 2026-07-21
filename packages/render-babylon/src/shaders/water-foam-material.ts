import { Engine } from "@babylonjs/core/Engines/engine";
import { Material } from "@babylonjs/core/Materials/material";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import type { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector2 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

/**
 * Procedural waterline foam for a submerged sprite (plan 166). A thin camera-facing quad
 * at the water surface across the sprite; its fragment shader paints a wavy white foam
 * crest line (two sine harmonics for irregular peaks, scrolling) — NO texture, so the
 * width (driven by the sprite's shadow radius) adapts to any Pokémon. Replaces the ugly
 * straight cut where the translucent water meets the sprite with a living wave.
 *
 * Set `time` each frame (seconds) and `foamColor` once (per liquid). Alpha-blended; keep
 * it in the sprite rendering group with an alpha index ABOVE the water surface so it draws
 * over the water, depth-write off / test on.
 */

const VERTEX_SOURCE = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;

const FRAGMENT_SOURCE = `
precision highp float;
varying vec2 vUv;
uniform float time;
uniform vec3 foamColor;
uniform float waveFrequency;
uniform float waveSpeed;
uniform float waveAmplitude;
uniform float foamThickness;
uniform float foamOpacity;
uniform vec2 pixelGrid;
uniform float dropletReach;
uniform float footDepth;
// Per-cell on/off hash (stable per pixel cell, re-rolled a few times a second → splash twinkle).
float hash(vec2 cell) {
  return fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
  // Snap to a chunky pixel grid → crisp pixel-art cells (no smooth gradient).
  vec2 cell = floor(vUv * pixelGrid);
  vec2 q = cell / pixelGrid;
  // Wavy crest across the width (two harmonics, scrolling) — the waterline the splash sits on.
  float w = sin(q.x * waveFrequency + time * waveSpeed) * 0.6
          + sin(q.x * waveFrequency * 2.3 - time * waveSpeed * 0.8) * 0.4;
  float crest = 0.5 + w * waveAmplitude;
  // Thin foam line hugging just below the crest (a couple of pixel rows — never a wash over the body).
  float below = crest - q.y;
  float band = step(0.0, below) * step(below, foamThickness);
  // Splash droplets: sparse crisp pixels just ABOVE the crest, twinkling — reads as spray.
  float above = crest - q.y; // negative above the crest
  float inSplashZone = step(-dropletReach, above) * step(above, 0.0);
  float droplet = inSplashZone * step(0.78, hash(cell + floor(time * 5.0)));
  // Binary alpha → hard pixel edges (pixel-art), never a soft ramp.
  if (max(band, droplet) < 0.5) discard;
  gl_FragColor = vec4(foamColor, foamOpacity);
  // Stamp the sprite's (near-biased) foot depth minus a hair, so the foam sorts JUST in
  // front of the submerged sprite but is still occluded by real terrain closer to the camera.
  gl_FragDepth = footDepth - 0.0008;
}`;

export interface WaterFoamMaterial {
  readonly material: ShaderMaterial;
  /** Advance the foam scroll (seconds). */
  setTime(seconds: number): void;
  /** Tint the foam to match the liquid. */
  setColor(color: Color3): void;
  /** The submerged sprite's flattened foot depth (window-space 0..1) so the foam sorts with it. */
  setFootDepth(depth: number): void;
  /**
   * Number of foam cells across the quad = its world size × the game's pixels-per-unit, so each
   * cell is exactly ONE game pixel (matches the Pokémon/water pixel scale, never stretched when
   * the quad is resized for a bigger/smaller sprite).
   */
  setPixelGrid(cellsX: number, cellsY: number): void;
  dispose(): void;
}

/**
 * Tunable pixel-art splash look. `PIXEL_GRID` = chunky cells across the quad (crisp
 * pixels). Thin foam line + sparse twinkling droplets above it = spray, never a wash
 * that covers the sprite body.
 */
const WAVE_FREQUENCY = 10;
const WAVE_SPEED = 1.0;
const WAVE_AMPLITUDE = 0.1; // crest wave height — low so the foam line barely moves vertically
const FOAM_THICKNESS = 0.3; // thick white foam band below the crest
const FOAM_OPACITY = 0.95;
const DROPLET_REACH = 0.3; // how far above the crest droplets can spray (short splash)

export function createWaterFoamMaterial(scene: Scene, name: string): WaterFoamMaterial {
  const material = new ShaderMaterial(
    name,
    scene,
    { vertexSource: VERTEX_SOURCE, fragmentSource: FRAGMENT_SOURCE },
    {
      attributes: ["position", "uv"],
      uniforms: [
        "worldViewProjection",
        "time",
        "foamColor",
        "waveFrequency",
        "waveSpeed",
        "waveAmplitude",
        "foamThickness",
        "foamOpacity",
        "pixelGrid",
        "dropletReach",
        "footDepth",
      ],
    },
  );
  material.transparencyMode = Material.MATERIAL_ALPHABLEND;
  material.alphaMode = Engine.ALPHA_COMBINE;
  material.backFaceCulling = false;
  material.disableDepthWrite = true;
  // The fragment stamps gl_FragDepth = footDepth (the sprite's own flattened, near-biased
  // depth) minus a hair — so the foam sorts JUST in front of the submerged sprite yet is
  // still occluded by real terrain closer to the camera (side blocks). Default depth test.
  material.setFloat("footDepth", 0.5);
  material.setFloat("waveFrequency", WAVE_FREQUENCY);
  material.setFloat("waveSpeed", WAVE_SPEED);
  material.setFloat("waveAmplitude", WAVE_AMPLITUDE);
  material.setFloat("foamThickness", FOAM_THICKNESS);
  material.setFloat("foamOpacity", FOAM_OPACITY);
  material.setVector2("pixelGrid", new Vector2(24, 6)); // replaced per sprite via setPixelGrid
  material.setFloat("dropletReach", DROPLET_REACH);
  material.setFloat("time", 0);

  return {
    material,
    setTime: (seconds) => material.setFloat("time", seconds),
    setColor: (color) => material.setColor3("foamColor", color),
    setFootDepth: (depth) => material.setFloat("footDepth", depth),
    setPixelGrid: (cellsX, cellsY) =>
      material.setVector2("pixelGrid", new Vector2(Math.max(1, cellsX), Math.max(1, cellsY))),
    dispose: () => material.dispose(),
  };
}
