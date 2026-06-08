import { Constants } from "@babylonjs/core/Engines/constants";
import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Matrix } from "@babylonjs/core/Maths/math.vector";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import {
  DAMAGE_FLASH_DURATION_MS,
  DAMAGE_FLASH_REPEAT,
  KO_TINT_COLOR,
  PULSE_MAX_SCALE,
  PULSE_MIN_SCALE,
} from "../constants.js";
import {
  BABYLON_ATTACK_DEPTH_BIAS,
  BABYLON_CONFUSION_WOBBLE_ANGLE,
  BABYLON_CONFUSION_WOBBLE_PERIOD_MS,
  BABYLON_DAMAGE_FLASH_DIM_EMISSIVE,
  BABYLON_DEFAULT_FRAME_DURATION_MS,
  BABYLON_HUD_ANCHOR_MARGIN_PX,
  BABYLON_PMD_DEFAULT_FRAME_TICKS,
  BABYLON_PMD_TICK_DURATION_MS,
  BABYLON_PREVIEW_FLASH_DIM_EMISSIVE,
  BABYLON_PREVIEW_FLASH_PERIOD_MS,
  BABYLON_PULSE_PERIOD_MS,
  BABYLON_SEMI_INVULNERABLE_LIFT,
  BABYLON_SHADOW_ALPHA,
  BABYLON_SHADOW_ALPHA_INDEX,
  BABYLON_SHADOW_GROUND_OFFSET,
  BABYLON_SHADOW_RADIUS_BY_SIZE,
  BABYLON_SHADOW_RADIUS_DEFAULT,
  BABYLON_SILHOUETTE_ALPHA,
  BABYLON_SILHOUETTE_RENDERING_GROUP,
  BABYLON_SPRITE_DEPTH_BIAS,
  BABYLON_SPRITE_GROUND_OFFSET_PX,
  BABYLON_SPRITE_RENDERING_GROUP,
} from "./babylon-constants.js";
import { SpriteDepthPlugin } from "./sprite-depth-plugin.js";

/** Animations that loop forever; everything else (Attack/Hop/Hurt/Faint/…) plays once. */
const LOOPING_ANIMATIONS: ReadonlySet<string> = new Set([
  "Idle",
  "Walk",
  "Sleep",
  "FlapAround",
  "Hover",
  "Special0",
  "Special10",
  "FlyingIdle",
]);

/**
 * Flying glide animations tried in priority order; the caller passes the fallback
 * (the 2D renderer uses the step's movement animation — Walk when gliding flat,
 * Hop on a cliff jump). FlyingIdle is synthesised from FlapAround; Hover is a
 * native loop; Special0/Special10 are the per-Pokémon glide poses (e.g. Dracolosse
 * #149 stores its flight as Special0).
 */
export const FLYING_GLIDE_CANDIDATES: readonly string[] = [
  "FlyingIdle",
  "Hover",
  "Special0",
  "Special10",
];

/** Resting animations tried in order when the atlas lacks the requested one (usually Idle). */
const RESTING_FALLBACK_CANDIDATES: readonly string[] = ["Idle", "FlyingIdle", "Hover", "Walk"];

/**
 * Renderer display variant of a semi-invulnerable turn (distinct from the core
 * `SemiInvulnerableState` enum): Vol = lifted, Creuse/Plongée both = hidden. J4
 * maps the core enum (Flying/Burrowing/Diving/Vanished) onto this display state.
 */
export type SemiInvulnerableDisplay = "flying" | "underground" | null;

export type PmdDirection =
  | "South"
  | "SouthEast"
  | "East"
  | "NorthEast"
  | "North"
  | "NorthWest"
  | "West"
  | "SouthWest";

const DIRECTION_SECTORS: readonly PmdDirection[] = [
  "South",
  "SouthEast",
  "East",
  "NorthEast",
  "North",
  "NorthWest",
  "West",
  "SouthWest",
];

interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
}

interface AtlasAnimationMeta {
  /** Per-frame PMD tick counts (AnimData `<Durations>`); length = the animation's frame count. */
  durations?: number[];
}

interface AtlasJson {
  frames: Record<string, AtlasFrame>;
  meta: {
    size: { w: number; h: number };
    animations?: Record<string, AtlasAnimationMeta>;
  };
}

/** One fully-loaded PMD atlas (texture + indexed frames + PMD offsets), swappable for the Clonage doll. */
interface AtlasBundle {
  texture: Texture;
  framesByKey: Map<string, AtlasFrame[]>;
  durationsByAnimation: Map<string, number[]>;
  atlasWidth: number;
  atlasHeight: number;
  footOffsetY: number;
  headOffsetY: number;
  shadowRadius: number;
}

export interface DirectionalBillboardOptions {
  scene: Scene;
  atlasJsonUrl: string;
  atlasPngUrl: string;
  /** Sprite offsets JSON (carries the PMD shadowSize). */
  offsetsJsonUrl: string;
  /**
   * Clonage (substitute) doll atlas — lazily loaded the first time the overlay
   * shows. Optional: the placement-preview billboard never holds a substitute.
   */
  substituteAtlasJsonUrl?: string;
  substituteAtlasPngUrl?: string;
  substituteOffsetsJsonUrl?: string;
  animation: string;
  worldFacing: number;
  frameDurationMs?: number;
  /**
   * The sprite is sized so each source pixel maps to 1/N world units — its
   * on-screen pixels match terrain textures drawn at the same density. Larger
   * PMD frames (Onix, Gyarados) then render proportionally bigger.
   */
  pixelsPerWorldUnit: number;
  /** Team colour (hex 0xRRGGBB) for the X-ray silhouette shown when occluded. Default white. */
  teamColor?: number;
}

/**
 * A flat plane that always faces the camera on Y, displaying one frame of a
 * PMDCollab directional atlas. The displayed PMD direction is derived from the
 * sprite's world facing minus the camera azimuth, so the right 8-way sprite is
 * shown as the camera rotates.
 *
 * Gotcha applied (spike 063):
 * - UV computed in the flipped (`invertY`) space: `vOffset = 1 - (y + h) / atlasH`.
 * - `transparencyMode = ALPHATEST` + `alphaCutOff = 0.5` so the sprite still
 *   writes to the depth buffer (occlusion) while keeping crisp pixel edges.
 */
export class DirectionalBillboard {
  readonly root: TransformNode;
  readonly worldFacing: { value: number };

  /**
   * Billboard pivot for the sprite plane: holds `BILLBOARDMODE_Y` so the plane
   * faces the camera, while the plane itself (a non-billboard child) carries the
   * confusion-wobble roll on its `rotation.z` — a billboard mesh ignores its own
   * `rotation.z`, but a child of a billboard pivot keeps its local roll (best
   * practice, plan 123 4d-6).
   */
  private readonly spritePivot: TransformNode;
  private readonly plane: Mesh;
  private readonly material: StandardMaterial;
  /** Base (real Pokémon) atlas, built on `load`. */
  private baseAtlas: AtlasBundle | null = null;
  /** Lazily-loaded Clonage (substitute) atlas — the shared `dummy` doll. */
  private substituteAtlas: AtlasBundle | null = null;
  /** True while the Clonage overlay is showing the dummy doll instead of the real sprite. */
  private substituteActive = false;
  /** Texture/frames/durations of the currently displayed atlas (base or substitute). Set on `load`. */
  private activeTexture!: Texture;
  /** Frames grouped by `"animation-direction"`, ordered by frame index, for the active atlas. */
  private activeFrames = new Map<string, AtlasFrame[]>();
  /** Per-frame PMD tick counts by animation name (active atlas meta) — drives per-frame playback speed. */
  private activeDurations = new Map<string, number[]>();
  private currentDirection: PmdDirection = "South";
  private currentFrameIndex = 0;
  private animation: string;
  private readonly frameDurationMs: number;
  private frameElapsedMs = 0;
  private atlasWidth = 1;
  private atlasHeight = 1;
  private pixelsPerWorldUnit: number;
  /** PMD foot offset (offsets.json): px the sprite is lifted above the tile top. Fallback = constant. */
  private footOffsetY = BABYLON_SPRITE_GROUND_OFFSET_PX;
  /** PMD head offset (offsets.json), px from frame center, negative = above. For HUD anchoring. */
  private headOffsetY = 0;
  /** Y offset (world) from root to the HUD anchor above the sprite head. */
  private spriteTopY = 0;
  private readonly shadow: Mesh;
  private readonly shadowMaterial: StandardMaterial;
  /** Flattens the sprite's depth to its foot point (native occlusion without self-clip). */
  private readonly depthPlugin: SpriteDepthPlugin;
  /** Team-coloured X-ray plane drawn only where the sprite is occluded by terrain. */
  private readonly silhouettePlane: Mesh;
  private readonly silhouetteMaterial: StandardMaterial;
  private readonly silhouetteDepthPlugin: SpriteDepthPlugin;

  /** Whether the current animation loops; one-shots clamp on their last frame. */
  private currentLoops = true;
  /** A non-looping animation has reached its last frame (no more advancing). */
  private oneShotComplete = false;
  /** When set, a finished one-shot freezes on its last frame instead of reverting to resting (Faint/KO). */
  private freezeOnComplete = false;
  /** Fired once when the current one-shot reaches its last frame. */
  private onAnimationComplete: (() => void) | null = null;
  /** Looping animation the sprite returns to after a one-shot ends (Idle by default; Sleep when asleep). */
  private restingAnimation: string;
  /** Frame world size before the active-pulse multiplier (so pulse scales the frame, not compounds). */
  private frameWorldWidth = 1;
  private frameWorldHeight = 1;
  /** Active-Pokémon pulse: breathing scale between PULSE_MIN/MAX_SCALE. */
  private pulsing = false;
  private pulseElapsedMs = 0;
  /** Damage flash: brief emissive brighten, `flashTicksLeft` half-cycles remaining. */
  private flashElapsedMs = 0;
  private flashTicksLeft = 0;
  /** Confirm-attack preview flash: sustained emissive sine pulse while a target is locked. */
  private previewFlashing = false;
  private previewFlashElapsedMs = 0;
  /** Confusion: sustained roll wobble of the sprite plane while the volatile is active. */
  private confusionWobbling = false;
  private confusionWobbleElapsedMs = 0;
  /** KO: sprite tinted dark and frozen (set after the Faint one-shot). */
  private knockedOut = false;
  /** True for the duration of an attack lunge — biases foot depth nearer + hides the silhouette. */
  private attacking = false;
  private semiInvulnerable: SemiInvulnerableDisplay = null;
  /** Pre-allocated emissive colours, swapped into the material (no per-tick allocation). */
  private readonly emissiveWhite = new Color3(1, 1, 1);
  private readonly emissiveKo = Color3.FromInts(
    (KO_TINT_COLOR >> 16) & 0xff,
    (KO_TINT_COLOR >> 8) & 0xff,
    KO_TINT_COLOR & 0xff,
  );
  private readonly emissiveFlashDim = new Color3(
    BABYLON_DAMAGE_FLASH_DIM_EMISSIVE,
    BABYLON_DAMAGE_FLASH_DIM_EMISSIVE,
    BABYLON_DAMAGE_FLASH_DIM_EMISSIVE,
  );
  /** Mutated each frame during the preview flash (no per-tick allocation). */
  private readonly emissivePreviewPulse = new Color3(1, 1, 1);

  get direction(): PmdDirection {
    return this.currentDirection;
  }

  constructor(private readonly options: DirectionalBillboardOptions) {
    this.worldFacing = { value: options.worldFacing };
    this.animation = options.animation;
    this.restingAnimation = options.animation;
    this.currentLoops = LOOPING_ANIMATIONS.has(options.animation);
    this.frameDurationMs = options.frameDurationMs ?? BABYLON_DEFAULT_FRAME_DURATION_MS;
    this.pixelsPerWorldUnit = options.pixelsPerWorldUnit;

    this.root = new TransformNode("pokemon_root", options.scene);

    // The atlas texture is created per-bundle in `loadAtlas` and bound to the
    // materials in `bindActiveAtlas` (so the Clonage doll can swap it in).
    this.material = new StandardMaterial("pokemon_mat", options.scene);
    this.material.emissiveColor = new Color3(1, 1, 1);
    this.material.disableLighting = true;
    this.material.useAlphaFromDiffuseTexture = true;
    this.material.backFaceCulling = false;
    this.material.transparencyMode = Material.MATERIAL_ALPHATEST; // keeps depth write
    this.material.alphaCutOff = 0.5;

    // Billboard pivot carries the camera-facing (BILLBOARDMODE_Y); the plane is a
    // plain child so its own rotation.z (confusion wobble) survives the billboard.
    this.spritePivot = new TransformNode("pokemon_sprite_pivot", options.scene);
    this.spritePivot.billboardMode = Mesh.BILLBOARDMODE_Y;
    this.spritePivot.parent = this.root;

    // Unit plane; final size set per-frame from pixelsPerWorldUnit + frame size.
    this.plane = MeshBuilder.CreatePlane("pokemon_plane", { width: 1, height: 1 }, options.scene);
    this.plane.material = this.material;
    this.plane.parent = this.spritePivot;
    // Native occlusion against the terrain depth (group 2, drawn AFTER terrain
    // group 0 and the silhouettes group 1, with autoClearDepthStencil disabled —
    // see combat-scene). `SpriteDepthPlugin` flattens the whole sprite to its
    // foot-point depth, so taller terrain in front occludes it while its own tile,
    // shadow and equal-height neighbours never clip it. Sprites sit in their own
    // group (not group 0) so they render after the silhouettes — a Pokémon behind
    // another Pokémon is then occluded normally, never X-rayed (silhouettes test
    // only against terrain depth, which excludes sprites).
    this.plane.renderingGroupId = BABYLON_SPRITE_RENDERING_GROUP;
    this.depthPlugin = new SpriteDepthPlugin(this.material);

    // Flat ground shadow disc under the sprite (placeholder until the PMD
    // Shadow.png ellipse system lands at Jalon 3). Sits just above the tile top.
    this.shadowMaterial = new StandardMaterial("pokemon_shadow_mat", options.scene);
    this.shadowMaterial.diffuseColor = new Color3(0, 0, 0);
    this.shadowMaterial.emissiveColor = new Color3(0, 0, 0);
    this.shadowMaterial.disableLighting = true;
    this.shadowMaterial.alpha = BABYLON_SHADOW_ALPHA;
    // Unit disc; radius set from the Pokemon's PMD shadowSize on load.
    this.shadow = MeshBuilder.CreateDisc("pokemon_shadow", { radius: 1 }, options.scene);
    this.shadow.material = this.shadowMaterial;
    this.shadow.rotation.x = Math.PI / 2;
    this.shadow.position.y = BABYLON_SHADOW_GROUND_OFFSET;
    this.shadow.isPickable = false;
    this.shadow.parent = this.root;
    this.shadow.scaling.set(BABYLON_SHADOW_RADIUS_DEFAULT, BABYLON_SHADOW_RADIUS_DEFAULT, 1);
    // Draw the shadow before tall-grass (transparent sort) so same-tile grass covers
    // it. The shadow keeps its geometry depth (NOT flattened to the sprite foot
    // depth) so the upright sprite stays in front of its own disc.
    this.shadow.alphaIndex = BABYLON_SHADOW_ALPHA_INDEX;

    // X-ray silhouette: a twin plane sharing the atlas texture (so its shape and
    // UV track the sprite frame), painted flat in the team colour via the atlas
    // alpha mask. `depthFunction = GREATER` + no depth write draws it ONLY where
    // the sprite sits behind terrain (its flattened foot depth loses the depth
    // test against the occluder), so units stay readable behind cliffs/walls.
    // Rendered in group 1 (after terrain + sprites) with the depth buffer kept
    // (`scene.setRenderingAutoClearDepthStencil(1, false)` in the combat scene).
    const team = options.teamColor ?? 0xffffff;
    this.silhouetteMaterial = new StandardMaterial("pokemon_silhouette_mat", options.scene);
    this.silhouetteMaterial.diffuseColor = new Color3(0, 0, 0);
    this.silhouetteMaterial.emissiveColor = Color3.FromInts(
      (team >> 16) & 0xff,
      (team >> 8) & 0xff,
      team & 0xff,
    );
    this.silhouetteMaterial.disableLighting = true;
    // opacityTexture is bound to the active atlas in `bindActiveAtlas` (post-load).
    this.silhouetteMaterial.backFaceCulling = false;
    this.silhouetteMaterial.transparencyMode = Material.MATERIAL_ALPHATEST;
    this.silhouetteMaterial.alphaCutOff = 0.5;
    this.silhouetteMaterial.alpha = BABYLON_SILHOUETTE_ALPHA;
    this.silhouetteMaterial.depthFunction = Constants.GREATER;
    this.silhouetteMaterial.disableDepthWrite = true;
    this.silhouetteDepthPlugin = new SpriteDepthPlugin(this.silhouetteMaterial);

    this.silhouettePlane = MeshBuilder.CreatePlane(
      "pokemon_silhouette",
      { width: 1, height: 1 },
      options.scene,
    );
    this.silhouettePlane.material = this.silhouetteMaterial;
    this.silhouettePlane.billboardMode = Mesh.BILLBOARDMODE_Y;
    this.silhouettePlane.parent = this.root;
    this.silhouettePlane.renderingGroupId = BABYLON_SILHOUETTE_RENDERING_GROUP;
    this.silhouettePlane.isPickable = false;
  }

  async load(): Promise<void> {
    this.baseAtlas = await this.loadAtlas({
      jsonUrl: this.options.atlasJsonUrl,
      pngUrl: this.options.atlasPngUrl,
      offsetsUrl: this.options.offsetsJsonUrl,
    });
    this.bindActiveAtlas(this.baseAtlas);
    this.resolveRestingFallback();
    this.applyCurrentFrame();
  }

  /**
   * Loads one PMD atlas (texture + indexed frames + offsets) into a self-contained
   * bundle. Used for both the real sprite (on `load`) and the lazily-loaded Clonage
   * doll (on first `setSubstitute(true)`), so each can be displayed by swapping the
   * active bundle without rebuilding the billboard.
   */
  private async loadAtlas(urls: {
    jsonUrl: string;
    pngUrl: string;
    offsetsUrl: string;
  }): Promise<AtlasBundle> {
    const texture = new Texture(
      urls.pngUrl,
      this.options.scene,
      true,
      true,
      Texture.NEAREST_SAMPLINGMODE,
    );
    texture.hasAlpha = true;
    texture.wrapU = Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    const [jsonResponse] = await Promise.all([
      fetch(urls.jsonUrl),
      new Promise<void>((resolve) => {
        texture.onLoadObservable.addOnce(() => resolve());
      }),
    ]);
    const json = (await jsonResponse.json()) as AtlasJson;
    const size = texture.getSize();
    const framesByKey = this.indexFramesByDirection(json);
    this.synthesizeFlyingIdle(framesByKey);
    const offsets = await this.loadOffsets(urls.offsetsUrl);
    return {
      texture,
      framesByKey,
      durationsByAnimation: this.indexDurations(json),
      atlasWidth: size.width,
      atlasHeight: size.height,
      footOffsetY: offsets.footOffsetY,
      headOffsetY: offsets.headOffsetY,
      shadowRadius: offsets.shadowRadius,
    };
  }

  /** Point the displayed texture, frames, durations, offsets and shadow at `bundle`. */
  private bindActiveAtlas(bundle: AtlasBundle): void {
    this.activeTexture = bundle.texture;
    this.activeFrames = bundle.framesByKey;
    this.activeDurations = bundle.durationsByAnimation;
    this.atlasWidth = bundle.atlasWidth;
    this.atlasHeight = bundle.atlasHeight;
    this.footOffsetY = bundle.footOffsetY;
    this.headOffsetY = bundle.headOffsetY;
    this.material.diffuseTexture = bundle.texture;
    this.silhouetteMaterial.opacityTexture = bundle.texture;
    this.shadow.scaling.set(bundle.shadowRadius, bundle.shadowRadius, 1);
  }

  /**
   * Some atlases carry no Idle at all (Dard/beedrill rests as Hover): fall back
   * through the resting candidates, else the first animation in the atlas.
   * Without this, `applyCurrentFrame` finds no frames and the texture keeps its
   * default full-sheet UVs — the whole sheet renders as a noise rectangle.
   */
  private resolveRestingFallback(): void {
    if (this.activeFrames.has(`${this.animation}-${this.currentDirection}`)) {
      return;
    }
    const candidates = [...RESTING_FALLBACK_CANDIDATES];
    const firstKey = this.activeFrames.keys().next().value;
    if (firstKey) {
      candidates.push(firstKey.slice(0, firstKey.lastIndexOf("-")));
    }
    const fallback = candidates.find((candidate) =>
      this.activeFrames.has(`${candidate}-${this.currentDirection}`),
    );
    if (fallback) {
      this.animation = fallback;
      this.restingAnimation = fallback;
    }
  }

  /**
   * Synthesises a looping `FlyingIdle` from `FlapAround` frames 0–1 per direction
   * (wings neutral → up), exactly like the 2D `SpriteLoader`: FlapAround's full
   * 18-frame cycle rotates through all 8 directions and reads wrong as a hover,
   * but its first two frames are a clean directional wing-flap. This is why
   * flyers without a dedicated hover (Roucool) still glide instead of hopping.
   */
  private synthesizeFlyingIdle(framesByKey: Map<string, AtlasFrame[]>): void {
    for (const direction of DIRECTION_SECTORS) {
      const flyingKey = `FlyingIdle-${direction}`;
      if (framesByKey.has(flyingKey)) {
        continue;
      }
      const flap = framesByKey.get(`FlapAround-${direction}`);
      if (!flap || flap.length < 2 || !flap[0] || !flap[1]) {
        continue;
      }
      framesByKey.set(flyingKey, [flap[0], flap[1]]);
    }
  }

  /**
   * Groups atlas frames by `"animation-direction"` (ordered by index) once, so
   * `applyCurrentFrame` is a map lookup instead of scanning every atlas key per
   * animation tick. Frame names are `"{animation}-{Direction}-{index}"`.
   */
  private indexFramesByDirection(json: AtlasJson): Map<string, AtlasFrame[]> {
    const framesByKey = new Map<string, AtlasFrame[]>();
    const grouped = new Map<string, { index: number; frame: AtlasFrame }[]>();
    for (const [name, frame] of Object.entries(json.frames)) {
      const lastDash = name.lastIndexOf("-");
      if (lastDash < 0) {
        continue;
      }
      const key = name.slice(0, lastDash);
      const index = Number(name.slice(lastDash + 1));
      const bucket = grouped.get(key) ?? [];
      bucket.push({ index, frame });
      grouped.set(key, bucket);
    }
    for (const [key, entries] of grouped) {
      entries.sort((a, b) => a.index - b.index);
      framesByKey.set(
        key,
        entries.map((entry) => entry.frame),
      );
    }
    return framesByKey;
  }

  /**
   * Reads the per-frame PMD durations from the atlas meta (`<Durations>` ticks),
   * keyed by animation name. Used by `currentFrameDurationMs` to hold each frame
   * for its real time instead of a single fixed duration (the 2D renderer did the
   * same: `durations[i] * TICK`), so idle/walk loops play at the canonical speed.
   */
  private indexDurations(json: AtlasJson): Map<string, number[]> {
    const durationsByAnimation = new Map<string, number[]>();
    const animations = json.meta.animations;
    if (!animations) {
      return durationsByAnimation;
    }
    for (const [name, meta] of Object.entries(animations)) {
      if (meta.durations && meta.durations.length > 0) {
        durationsByAnimation.set(name, meta.durations);
      }
    }
    return durationsByAnimation;
  }

  /** Real display time (ms) of the current frame: its PMD tick count × tick duration, else the fixed fallback. */
  private currentFrameDurationMs(): number {
    const durations = this.activeDurations.get(this.animation);
    if (!durations || durations.length === 0) {
      return this.frameDurationMs;
    }
    const ticks =
      durations[this.currentFrameIndex % durations.length] ?? BABYLON_PMD_DEFAULT_FRAME_TICKS;
    // Clamp to ≥1 tick: a 0-duration frame would spin the advance loop forever.
    return Math.max(1, ticks) * BABYLON_PMD_TICK_DURATION_MS;
  }

  /**
   * Total play time (ms) of an animation for the current facing — sum of its
   * per-frame PMD durations (else frameCount × fallback). 0 if the atlas lacks it.
   * Used to pace the resolution on a KO so the Faint plays out fully (parity).
   */
  animationDurationMs(animation: string): number {
    const frames = this.activeFrames.get(`${animation}-${this.currentDirection}`);
    if (!frames || frames.length === 0) {
      return 0;
    }
    const durations = this.activeDurations.get(animation);
    if (!durations || durations.length === 0) {
      return frames.length * this.frameDurationMs;
    }
    return durations.reduce(
      (sum, ticks) => sum + Math.max(1, ticks) * BABYLON_PMD_TICK_DURATION_MS,
      0,
    );
  }

  /**
   * Loads PMD offsets.json: the per-sprite grounding data (`idleFrameHeight`,
   * `footOffsetY`) and `shadowSize`. The same fields the Phaser renderer used to
   * align sprites (see `PokemonSprite.drawShadow`).
   */
  private async loadOffsets(
    offsetsUrl: string,
  ): Promise<{ footOffsetY: number; headOffsetY: number; shadowRadius: number }> {
    const defaults = {
      footOffsetY: BABYLON_SPRITE_GROUND_OFFSET_PX,
      headOffsetY: 0,
      shadowRadius: BABYLON_SHADOW_RADIUS_DEFAULT,
    };
    try {
      const response = await fetch(offsetsUrl);
      if (!response.ok) {
        return defaults;
      }
      const offsets = (await response.json()) as {
        shadowSize?: number;
        headOffsetY?: number;
        footOffsetY?: number;
      };
      return {
        headOffsetY: offsets.headOffsetY ?? 0,
        footOffsetY: offsets.footOffsetY ?? BABYLON_SPRITE_GROUND_OFFSET_PX,
        shadowRadius:
          BABYLON_SHADOW_RADIUS_BY_SIZE[offsets.shadowSize ?? 1] ?? BABYLON_SHADOW_RADIUS_DEFAULT,
      };
    } catch {
      return defaults;
    }
  }

  /** True if the atlas carries this animation for the current facing. */
  hasAnimation(animation: string): boolean {
    return this.activeFrames.has(`${animation}-${this.currentDirection}`);
  }

  /**
   * Clonage (substitute): swap the displayed sprite to the shared `dummy` doll while
   * the volatile is up, and back to the real sprite when it breaks. Mirrors the 2D
   * `PokemonSprite.setSubstituteOverlay` (`getEffectiveSpriteId` → SUBSTITUTE_SPRITE_ID).
   * The doll atlas is loaded once on first use. Replays the current animation against
   * the new atlas (falling back to a resting pose the doll actually carries).
   */
  async setSubstitute(active: boolean): Promise<void> {
    if (this.substituteActive === active) {
      return;
    }
    this.substituteActive = active;
    const { substituteAtlasJsonUrl, substituteAtlasPngUrl, substituteOffsetsJsonUrl } =
      this.options;
    if (active && !this.substituteAtlas) {
      if (!(substituteAtlasJsonUrl && substituteAtlasPngUrl && substituteOffsetsJsonUrl)) {
        return;
      }
      this.substituteAtlas = await this.loadAtlas({
        jsonUrl: substituteAtlasJsonUrl,
        pngUrl: substituteAtlasPngUrl,
        offsetsUrl: substituteOffsetsJsonUrl,
      });
    }
    // A late-resolving load may race a flip back to the real sprite — honour the
    // latest requested state, not this call's.
    const target = this.substituteActive ? this.substituteAtlas : this.baseAtlas;
    if (!target) {
      return;
    }
    this.bindActiveAtlas(target);
    this.resolveRestingFallback();
    this.applyCurrentFrame();
  }

  /**
   * Play a looping animation (Idle/Walk/Sleep/FlyingIdle…). No-op if it is already
   * the current looping animation, so a repeated Walk never resets to frame 0
   * (matches the 2D renderer's same-looping-key guard).
   */
  setAnimation(animation: string): void {
    if (this.animation === animation && this.currentLoops && !this.oneShotComplete) {
      return;
    }
    this.startAnimation(animation, { freezeOnComplete: false, onComplete: null });
  }

  /** Set the looping animation the sprite reverts to after a one-shot (Idle, or Sleep when asleep). */
  setRestingAnimation(animation: string): void {
    this.restingAnimation = animation;
  }

  /**
   * Play a one-shot animation (Attack/Shoot/Hop/Hurt/Charge…). On its last frame it
   * reverts to the resting animation, unless `freeze` (Faint/KO) keeps it on the
   * last frame. `onComplete` fires once when the last frame is reached.
   */
  playOnce(animation: string, options: { freeze?: boolean; onComplete?: () => void } = {}): void {
    this.startAnimation(animation, {
      freezeOnComplete: options.freeze ?? false,
      onComplete: options.onComplete ?? null,
    });
  }

  /** Play the first available candidate (looping), else the fallback. Used for the flying glide. */
  playFirstAvailable(candidates: readonly string[], fallback: string): string {
    const chosen = candidates.find((candidate) => this.hasAnimation(candidate)) ?? fallback;
    this.setAnimation(chosen);
    return chosen;
  }

  private startAnimation(
    animation: string,
    options: { freezeOnComplete: boolean; onComplete: (() => void) | null },
  ): void {
    this.animation = animation;
    this.currentLoops = LOOPING_ANIMATIONS.has(animation);
    this.oneShotComplete = false;
    this.freezeOnComplete = options.freezeOnComplete;
    this.onAnimationComplete = options.onComplete;
    this.currentFrameIndex = 0;
    this.frameElapsedMs = 0;
    this.applyCurrentFrame();
  }

  setWorldFacing(angleRadians: number): void {
    this.worldFacing.value = angleRadians;
  }

  /** Live tuning: source pixels per world unit (lower = bigger sprite + bigger texels). */
  setPixelsPerWorldUnit(value: number): void {
    this.pixelsPerWorldUnit = value;
    this.applyCurrentFrame();
  }

  /** Active-Pokémon breathing pulse (scale oscillation). */
  setActive(active: boolean): void {
    this.pulsing = active;
    if (!active) {
      this.pulseElapsedMs = 0;
      this.refreshTransform();
    }
  }

  /** Trigger a brief damage flash (a few emissive dim/restore half-cycles) + the Hurt recoil pose. */
  flashDamage(): void {
    this.flashTicksLeft = DAMAGE_FLASH_REPEAT * 2;
    this.flashElapsedMs = 0;
    // Parity with Phaser flashDamage: a hit also plays the Hurt pose (when the atlas
    // carries it for this facing), reverting to the resting animation when it ends.
    if (!this.knockedOut && this.hasAnimation("Hurt")) {
      this.playOnce("Hurt");
    }
  }

  /**
   * Confirm-attack preview flash: a sustained emissive sine pulse marking a locked
   * target (parity with Phaser's alpha blink). Restores the base emissive on stop.
   */
  setPreviewFlash(active: boolean): void {
    if (this.previewFlashing === active) {
      return;
    }
    this.previewFlashing = active;
    this.previewFlashElapsedMs = 0;
    if (!active) {
      this.applyBaseEmissive();
    }
  }

  /** Confusion: roll the sprite plane back and forth while active; reset upright on stop. */
  setConfusionWobble(active: boolean): void {
    if (this.confusionWobbling === active) {
      return;
    }
    this.confusionWobbling = active;
    this.confusionWobbleElapsedMs = 0;
    if (!active) {
      this.plane.rotation.z = 0;
    }
  }

  /**
   * KO: dark tint + play the Faint pose ONCE (it animates then freezes on its last
   * frame via `freezeOnComplete`). Owning the Faint here (on the false→true edge)
   * means a repeated `setKnockedOut(true)` from `syncBoard` doesn't restart it, and
   * the frame advance is NOT gated on `knockedOut` (the one-shot freezes itself).
   */
  setKnockedOut(knockedOut: boolean): void {
    const wasKnockedOut = this.knockedOut;
    this.knockedOut = knockedOut;
    this.applyBaseEmissive();
    // Hide the ground shadow on KO (parity with Phaser darkenSprite): a fainted
    // Pokémon no longer casts one.
    this.shadow.setEnabled(!knockedOut);
    if (knockedOut && !wasKnockedOut) {
      // A fainting Pokémon stops wobbling and settles upright (parity with Phaser).
      this.setConfusionWobble(false);
      if (this.hasAnimation("Faint")) {
        this.playOnce("Faint", { freeze: true });
      }
    }
  }

  /**
   * Vol (flying) lifts the sprite ≈2 tiles and plays its glide animation;
   * Creuse/Plongée (underground) hides the sprite but keeps the ground shadow
   * (the tile is still occupied). Landing (null) reverts to the resting animation.
   */
  setSemiInvulnerable(state: SemiInvulnerableDisplay): void {
    const previous = this.semiInvulnerable;
    this.semiInvulnerable = state;
    const hidden = state === "underground";
    this.plane.setEnabled(!hidden);
    this.silhouettePlane.setEnabled(!hidden);
    // Shadow stays: a semi-invulnerable Pokémon still occupies its tile.
    if (state === "flying") {
      this.playFirstAvailable(FLYING_GLIDE_CANDIDATES, "Walk");
    } else if (previous === "flying" && state === null) {
      this.setAnimation(this.restingAnimation);
    }
    this.refreshTransform();
  }

  /**
   * Mark an attack lunge: biases the foot depth nearer (see updateFootDepth) so a
   * coplanar front tile no longer clips the enlarged frame. The X-ray silhouette is
   * left on — the same bias keeps it from triggering on same-level tiles, so it still
   * appears only when genuinely taller terrain occludes the attacker.
   */
  setAttacking(active: boolean): void {
    this.attacking = active;
  }

  update(deltaMs: number, cameraAzimuth: number, viewProjection: Matrix): void {
    let needsApply = false;

    const nextDirection = computeDisplayDirection(this.worldFacing.value, cameraAzimuth);
    if (nextDirection !== this.currentDirection) {
      this.currentDirection = nextDirection;
      needsApply = true;
    }

    // Advance frames normally; once KO'd, only let the Faint one-shot keep playing
    // until it lands on its last frame (then `oneShotComplete` freezes it). A KO'd
    // sprite without a Faint stays on its current frame (its looping anim is gated
    // out), so it never idles while dead.
    const faintStillPlaying = this.knockedOut && !this.currentLoops && !this.oneShotComplete;
    if (!this.knockedOut || faintStillPlaying) {
      // Subtract per frame (not reset to 0) so animation speed is frame-rate independent.
      // Each frame is held for its OWN PMD duration; recompute after every advance.
      this.frameElapsedMs += deltaMs;
      let frameDuration = this.currentFrameDurationMs();
      while (this.frameElapsedMs >= frameDuration) {
        this.frameElapsedMs -= frameDuration;
        if (this.advanceFrame()) {
          needsApply = true;
        }
        frameDuration = this.currentFrameDurationMs();
      }
    }

    if (needsApply) {
      this.applyCurrentFrame();
    }

    this.updatePulse(deltaMs);
    this.updateFlash(deltaMs);
    this.updatePreviewFlash(deltaMs);
    this.updateConfusionWobble(deltaMs);
    this.updateFootDepth(viewProjection);
  }

  /**
   * Advances one frame. Looping animations wrap; one-shots clamp on their last
   * frame, then either freeze (Faint) or revert to the resting animation, firing
   * `onAnimationComplete` once. Returns whether the displayed frame changed.
   */
  private advanceFrame(): boolean {
    if (this.currentLoops) {
      this.currentFrameIndex += 1;
      return true;
    }
    if (this.oneShotComplete) {
      return false;
    }
    const frames = this.activeFrames.get(`${this.animation}-${this.currentDirection}`);
    const lastIndex = (frames?.length ?? 1) - 1;
    if (this.currentFrameIndex < lastIndex) {
      this.currentFrameIndex += 1;
      return true;
    }
    this.oneShotComplete = true;
    const onComplete = this.onAnimationComplete;
    this.onAnimationComplete = null;
    if (!this.freezeOnComplete) {
      this.startAnimation(this.restingAnimation, { freezeOnComplete: false, onComplete: null });
    }
    onComplete?.();
    return true;
  }

  /** Re-applies plane scale (frame size × active pulse) and Y (foot lift + flying lift). */
  private refreshTransform(): void {
    const pulse = this.pulsing ? this.pulseFactor() : 1;
    this.plane.scaling.set(this.frameWorldWidth * pulse, this.frameWorldHeight * pulse, 1);
    this.silhouettePlane.scaling.set(
      this.frameWorldWidth * pulse,
      this.frameWorldHeight * pulse,
      1,
    );
    const lift = this.semiInvulnerable === "flying" ? BABYLON_SEMI_INVULNERABLE_LIFT : 0;
    const baseY = this.footOffsetY / this.pixelsPerWorldUnit + lift;
    this.plane.position.y = baseY;
    this.silhouettePlane.position.y = baseY;
  }

  /** Eased breathing factor in [PULSE_MIN_SCALE, PULSE_MAX_SCALE] over one period. */
  private pulseFactor(): number {
    const phase = (1 - Math.cos((2 * Math.PI * this.pulseElapsedMs) / BABYLON_PULSE_PERIOD_MS)) / 2;
    return PULSE_MIN_SCALE + (PULSE_MAX_SCALE - PULSE_MIN_SCALE) * phase;
  }

  private updatePulse(deltaMs: number): void {
    if (!this.pulsing) {
      return;
    }
    this.pulseElapsedMs = (this.pulseElapsedMs + deltaMs) % BABYLON_PULSE_PERIOD_MS;
    this.refreshTransform();
  }

  private updateFlash(deltaMs: number): void {
    if (this.flashTicksLeft <= 0) {
      return;
    }
    this.flashElapsedMs += deltaMs;
    if (this.flashElapsedMs < DAMAGE_FLASH_DURATION_MS) {
      return;
    }
    this.flashElapsedMs -= DAMAGE_FLASH_DURATION_MS;
    this.flashTicksLeft -= 1;
    if (this.flashTicksLeft <= 0) {
      this.applyBaseEmissive();
    } else {
      // Dim on odd half-cycles, restore base on even — reads as a hit blink.
      const dim = this.flashTicksLeft % 2 === 1;
      this.material.emissiveColor = dim ? this.emissiveFlashDim : this.baseEmissive();
    }
  }

  private updatePreviewFlash(deltaMs: number): void {
    // The transient damage flash + KO tint take priority over the preview pulse.
    if (!this.previewFlashing || this.flashTicksLeft > 0 || this.knockedOut) {
      return;
    }
    this.previewFlashElapsedMs =
      (this.previewFlashElapsedMs + deltaMs) % BABYLON_PREVIEW_FLASH_PERIOD_MS;
    // 0→1→0 over the period; lerp white↔dim grey (a darkening blink).
    const phase =
      (1 - Math.cos((2 * Math.PI * this.previewFlashElapsedMs) / BABYLON_PREVIEW_FLASH_PERIOD_MS)) /
      2;
    const level = 1 - phase * (1 - BABYLON_PREVIEW_FLASH_DIM_EMISSIVE);
    this.emissivePreviewPulse.set(level, level, level);
    this.material.emissiveColor = this.emissivePreviewPulse;
  }

  private updateConfusionWobble(deltaMs: number): void {
    if (!this.confusionWobbling) {
      return;
    }
    this.confusionWobbleElapsedMs =
      (this.confusionWobbleElapsedMs + deltaMs) % BABYLON_CONFUSION_WOBBLE_PERIOD_MS;
    // Smooth ±angle roll over the period (sine, like the Phaser yoyo tween).
    const phase =
      (2 * Math.PI * this.confusionWobbleElapsedMs) / BABYLON_CONFUSION_WOBBLE_PERIOD_MS;
    this.plane.rotation.z = Math.sin(phase) * BABYLON_CONFUSION_WOBBLE_ANGLE;
  }

  private baseEmissive(): Color3 {
    return this.knockedOut ? this.emissiveKo : this.emissiveWhite;
  }

  private applyBaseEmissive(): void {
    this.material.emissiveColor = this.baseEmissive();
  }

  /**
   * Projects the sprite's foot (its root = tile-top centre) to window-space depth
   * and feeds it to both depth plugins, so the whole billboard depth-sorts as a
   * flat token standing on its tile (occluded only by genuinely taller terrain
   * in front, never by its own tile/shadow). The caller passes the shared
   * per-frame `viewProjection` so the matrix is built once, not once per sprite.
   */
  private updateFootDepth(viewProjection: Matrix): void {
    // Perspective-divides internally → NDC z in [-1, 1]; remap to window [0, 1].
    const ndc = Vector3.TransformCoordinates(this.root.position, viewProjection);
    // An attack lunge biases the sprite nearer so a coplanar front tile can't clip the
    // enlarged frame — but not past one height step, so taller tiles still occlude.
    const bias = BABYLON_SPRITE_DEPTH_BIAS + (this.attacking ? BABYLON_ATTACK_DEPTH_BIAS : 0);
    const footDepth = Math.min(1, Math.max(0, 0.5 * ndc.z + 0.5 - bias));
    this.depthPlugin.footDepth = footDepth;
    this.silhouetteDepthPlugin.footDepth = footDepth;
  }

  dispose(): void {
    this.material.dispose();
    this.baseAtlas?.texture.dispose();
    this.substituteAtlas?.texture.dispose();
    this.plane.dispose();
    this.spritePivot.dispose();
    this.silhouetteMaterial.dispose();
    this.silhouettePlane.dispose();
    this.shadowMaterial.dispose();
    this.shadow.dispose();
    this.root.dispose();
  }

  private applyCurrentFrame(): void {
    const frames = this.activeFrames.get(`${this.animation}-${this.currentDirection}`);
    if (!frames || frames.length === 0) {
      return;
    }
    const frame = frames[this.currentFrameIndex % frames.length];
    if (!frame) {
      return;
    }

    const { x, y, w, h } = frame.frame;
    this.activeTexture.uOffset = x / this.atlasWidth;
    this.activeTexture.vOffset = 1 - (y + h) / this.atlasHeight;
    this.activeTexture.uScale = w / this.atlasWidth;
    this.activeTexture.vScale = h / this.atlasHeight;

    // Frame base size (pre-pulse); the sprite's frame center sits on the tile's
    // top-face center (the root). `refreshTransform` then applies the active-pulse
    // scale and the flying semi-invulnerable Y lift on top of this base.
    this.frameWorldHeight = h / this.pixelsPerWorldUnit;
    this.frameWorldWidth = this.frameWorldHeight * (w / h);
    this.refreshTransform();
    // HUD anchor: headOffsetY is measured up from the frame center (negative =
    // above), matching Phaser's `uiOffsetY`.
    this.spriteTopY = (-this.headOffsetY + BABYLON_HUD_ANCHOR_MARGIN_PX) / this.pixelsPerWorldUnit;
  }

  /** Y offset (world units) from the root to the top of the current sprite frame, for HUD anchoring. */
  get spriteTopOffsetY(): number {
    return this.spriteTopY;
  }
}

/**
 * Maps a world facing angle (radians) and the camera azimuth to one of the 8
 * PMD directions. Pure function — covered by the renderer harness tests.
 */
export function computeDisplayDirection(
  worldFacingRadians: number,
  cameraAzimuthRadians: number,
): PmdDirection {
  const relative = worldFacingRadians - cameraAzimuthRadians;
  const normalized = ((relative % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const sector = Math.round(normalized / (Math.PI / 4)) % 8;
  const direction = DIRECTION_SECTORS[sector];
  if (!direction) {
    throw new Error(`Invalid sector ${sector}`);
  }
  return direction;
}
