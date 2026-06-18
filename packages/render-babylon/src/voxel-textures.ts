import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import type { VisualTerrainGroup } from "@pokemon-tactic/view-core";

/**
 * Voxel (Minecraft) re-skin of the terrain (plan 129, temps 1). Maps each gameplay
 * visual terrain group to a vanilla Minecraft block. Block names follow vanilla file
 * names so dropping the real (gitignored, copyrighted) texture pack into
 * `public/assets/minecraft/block/` just works; absent → procedural fallback tinted
 * with `color`, so the game runs with zero copyrighted asset committed.
 */

export type Rgb = readonly [number, number, number];

export interface BlockSpec {
  readonly top: string;
  /** Distinct side texture (grass-like); omitted → side reuses a darkened `top`. */
  readonly side?: string;
  readonly color: Rgb;
  readonly liquid?: boolean;
  /**
   * Biome tint (0..255) multiplied onto the TOP face — mirrors how Minecraft colours
   * greyscale grass/foliage AND water per biome at runtime. Grass tint can be
   * overridden per map; swamp water uses its fixed value here.
   */
  readonly tint?: Rgb;
}

export const BLOCK_TEXTURE_BASE = "assets/minecraft/block";
const BLOCK_TEXTURE_SIZE = 16;

// --- Biome tints (0..255), multiplied onto greyscale grass / water tops like MC does. ---

// OFFICIAL Minecraft biome colours (MC Wiki / biome data — canonical hex, not eyeballed).
const GRASS_TINT_PLAINS: Rgb = [145, 189, 89]; // #91BD59
const GRASS_TINT_FOREST: Rgb = [121, 192, 90]; // #79C05A
const GRASS_TINT_SWAMP: Rgb = [106, 112, 57]; // #6A7039 (hardcoded in vanilla)

// OFFICIEUX — deliberate art choices for THIS game, NOT vanilla Minecraft (which has no
// purple/poison water; its water is only blue/green by biome). Tweak freely.
const WATER_TINT_POISON: Rgb = [150, 105, 170]; // toxic swamp water, Pokémon Poison vibe

/** Default grass biome tint — plains (the lighter "prairie" green). */
export const DEFAULT_GRASS_TINT: Rgb = GRASS_TINT_PLAINS;

/** Dirt base + greyscale grass fringe overlay — the two layers MC composites for a grass side. */
const DIRT_BLOCK = "dirt";
const GRASS_SIDE_OVERLAY_BLOCK = "grass_block_side_overlay";

/** Per-map grass biome tint override (by map basename) — official MC biome colours. */
const GRASS_TINT_BY_MAP: Readonly<Record<string, Rgb>> = {
  forest: GRASS_TINT_FOREST,
  swamp: GRASS_TINT_SWAMP,
  // simple-arena (+ any unlisted map) → plains via DEFAULT_GRASS_TINT.
};

/** Grass biome tint for a map URL (`…/<name>.tmj`), falling back to the default green. */
export function grassTintForMap(mapUrl: string): Rgb {
  const name = mapUrl.split("/").pop()?.replace(".tmj", "") ?? "";
  return GRASS_TINT_BY_MAP[name] ?? DEFAULT_GRASS_TINT;
}

export const GROUP_TO_BLOCK: Readonly<Record<VisualTerrainGroup, BlockSpec>> = {
  herbe: {
    top: "grass_block_top",
    side: "grass_block_side",
    color: [99, 158, 60],
    tint: DEFAULT_GRASS_TINT,
  },
  tall_grass: {
    top: "grass_block_top",
    side: "grass_block_side",
    color: [120, 175, 70],
    tint: DEFAULT_GRASS_TINT,
  },
  roche: { top: "stone", color: [128, 128, 128] },
  brique: { top: "bricks", color: [150, 84, 70] },
  sable: { top: "sand", color: [219, 207, 163] },
  pave: { top: "cobblestone", color: [122, 122, 122] },
  path: { top: "dirt_path_top", side: "dirt_path_side", color: [148, 120, 70] },
  wood: { top: "oak_planks", color: [162, 130, 78] },
  snow: { top: "snow", color: [240, 246, 250] },
  ice: { top: "ice", color: [140, 176, 226] },
  magma: { top: "magma", color: [120, 50, 30] },
  water: { top: "water_still", color: [60, 110, 200], liquid: true },
  deep_water: { top: "water_still", color: [40, 80, 165], liquid: true },
  lava: { top: "lava_still", color: [220, 110, 30], liquid: true },
  // Poison swamp water — officieux (see WATER_TINT_POISON): toxic purple over the
  // translucent water texture.
  swamp: { top: "water_still", color: [120, 80, 140], liquid: true, tint: WATER_TINT_POISON },
};

/** Procedural 16×16 stand-in: base colour + deterministic per-pixel jitter + bevel. */
function proceduralTexture(scene: Scene, key: string, [r, g, b]: Rgb): DynamicTexture {
  const texture = new DynamicTexture(
    `proc_${key}`,
    { width: BLOCK_TEXTURE_SIZE, height: BLOCK_TEXTURE_SIZE },
    scene,
    false,
    Texture.NEAREST_SAMPLINGMODE,
  );
  const context = texture.getContext() as CanvasRenderingContext2D;
  let seed = 0;
  for (let index = 0; index < key.length; index++) {
    seed = (seed * 31 + key.charCodeAt(index)) & 0xffff;
  }
  for (let y = 0; y < BLOCK_TEXTURE_SIZE; y++) {
    for (let x = 0; x < BLOCK_TEXTURE_SIZE; x++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const jitter = ((seed >> 8) % 28) - 14;
      const edge =
        x === 0 || y === 0 || x === BLOCK_TEXTURE_SIZE - 1 || y === BLOCK_TEXTURE_SIZE - 1;
      const shade = edge ? -40 : jitter;
      const channel = (value: number): number => Math.max(0, Math.min(255, value + shade));
      context.fillStyle = `rgb(${channel(r)},${channel(g)},${channel(b)})`;
      context.fillRect(x, y, 1, 1);
    }
  }
  texture.update();
  return texture;
}

function blockTexture(
  scene: Scene,
  material: StandardMaterial,
  blockName: string,
  color: Rgb,
): Texture {
  // The extruder is synchronous, so we construct the real PNG Texture now and let
  // its async `onError` (404 when the local pack is absent) swap the material's
  // diffuse to a procedural stand-in. Mutating the live material is safe: it fires
  // before the texture ever contributes pixels.
  const texture = new Texture(
    `${BLOCK_TEXTURE_BASE}/${blockName}.png`,
    scene,
    true,
    true,
    Texture.NEAREST_SAMPLINGMODE,
    null,
    () => {
      const fallback = proceduralTexture(scene, blockName, color);
      fallback.hasAlpha = texture.hasAlpha;
      material.diffuseTexture = fallback;
      texture.dispose();
    },
  );
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.hasAlpha = true;
  return texture;
}

export interface BlockMaterialOptions {
  /** Use the distinct side texture (grass-like); else reuse top. */
  readonly face: "top" | "side";
  /** Darken factor for reused-top sides (1 = full bright). */
  readonly darken?: number;
  /** Overrides `spec.tint` for tinted blocks (per-map grass biome colour). */
  readonly tintOverride?: Rgb;
}

/**
 * Flat-shaded (pixel-art) material for one block face — real MC texture or procedural
 * fallback. Mirrors the project's terrain look (`emissiveColor` + `disableLighting`,
 * no specular); liquids get alpha.
 */
export function makeBlockMaterial(
  scene: Scene,
  group: VisualTerrainGroup,
  options: BlockMaterialOptions,
): StandardMaterial {
  const spec = GROUP_TO_BLOCK[group];
  const useDistinctSide = options.face === "side" && spec.side !== undefined;
  const blockName = useDistinctSide && spec.side ? spec.side : spec.top;
  const material = new StandardMaterial(`block_${group}_${options.face}`, scene);
  material.diffuseTexture = blockTexture(scene, material, blockName, spec.color);
  // Top face of a tinted block (grass) → multiply by the biome colour so the greyscale
  // Minecraft texture reads green; otherwise flat white, or darkened for a reused-top side.
  const tint =
    options.face === "top" && spec.tint ? (options.tintOverride ?? spec.tint) : undefined;
  if (tint) {
    material.emissiveColor = new Color3(tint[0] / 255, tint[1] / 255, tint[2] / 255);
  } else {
    const shade = options.face === "side" && !useDistinctSide ? (options.darken ?? 0.65) : 1;
    material.emissiveColor = new Color3(shade, shade, shade);
  }
  material.disableLighting = true;
  material.specularColor = new Color3(0, 0, 0);
  if (spec.liquid) {
    material.alpha = 0.82;
  }
  return material;
}

function loadImage(blockName: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = `${BLOCK_TEXTURE_BASE}/${blockName}.png`;
  });
}

/**
 * Grass block side, composited the way the Minecraft engine does it: an untinted `dirt`
 * base + the GREYSCALE grass fringe overlay multiplied by the biome `tint` (alpha-masked
 * to the fringe pixels). Built asynchronously into a `DynamicTexture` and swapped into the
 * live material once both source PNGs load; until then the dirt-coloured placeholder shows.
 * Falls back to a plain dirt-tone fill if the textures are absent (no local pack).
 */
export function makeGrassSideMaterial(scene: Scene, tint: Rgb): StandardMaterial {
  const material = new StandardMaterial("block_grass_side_composite", scene);
  material.emissiveColor = new Color3(1, 1, 1);
  material.disableLighting = true;
  material.specularColor = new Color3(0, 0, 0);

  const dynamic = new DynamicTexture(
    "grass_side_composite",
    { width: BLOCK_TEXTURE_SIZE, height: BLOCK_TEXTURE_SIZE },
    scene,
    false,
    Texture.NEAREST_SAMPLINGMODE,
  );
  dynamic.wrapU = Texture.WRAP_ADDRESSMODE;
  dynamic.wrapV = Texture.WRAP_ADDRESSMODE;
  material.diffuseTexture = dynamic;

  const context = dynamic.getContext() as CanvasRenderingContext2D;
  context.imageSmoothingEnabled = false;

  Promise.all([loadImage(DIRT_BLOCK), loadImage(GRASS_SIDE_OVERLAY_BLOCK)])
    .then(([dirt, overlay]) => {
      const size = BLOCK_TEXTURE_SIZE;
      context.clearRect(0, 0, size, size);
      // A DynamicTexture canvas samples Y-flipped vs a file Texture, so the fringe (top
      // of the source PNG) would land at the bottom. Pre-flip the canvas to cancel it.
      context.save();
      context.translate(0, size);
      context.scale(1, -1);
      context.drawImage(dirt, 0, 0, size, size);

      // Tint the greyscale overlay on a scratch canvas: multiply by the biome colour,
      // then mask back to the overlay's own alpha so only the fringe pixels survive.
      const scratch = document.createElement("canvas");
      scratch.width = size;
      scratch.height = size;
      const scratchContext = scratch.getContext("2d");
      if (scratchContext) {
        scratchContext.imageSmoothingEnabled = false;
        scratchContext.drawImage(overlay, 0, 0, size, size);
        scratchContext.globalCompositeOperation = "multiply";
        scratchContext.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`;
        scratchContext.fillRect(0, 0, size, size);
        scratchContext.globalCompositeOperation = "destination-in";
        scratchContext.drawImage(overlay, 0, 0, size, size);
        context.drawImage(scratch, 0, 0, size, size);
      }
      context.restore();
      dynamic.update(false);
    })
    .catch(() => {
      context.fillStyle = "rgb(134,96,67)"; // dirt tone fallback (no local pack)
      context.fillRect(0, 0, BLOCK_TEXTURE_SIZE, BLOCK_TEXTURE_SIZE);
      dynamic.update(false);
    });

  return material;
}
