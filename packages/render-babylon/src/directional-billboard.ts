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
  type AtlasFrame,
  type AtlasJson,
  indexAtlasDurations,
  indexFramesByDirection,
  PmdAnimationController,
  type PmdDirection,
  type SemiInvulnerableDisplay,
  synthesizeFlyingIdle,
} from "@pokemon-tactic/view-core";
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
import {
  DAMAGE_FLASH_DURATION_MS,
  DAMAGE_FLASH_REPEAT,
  KO_TINT_COLOR,
  PULSE_MAX_SCALE,
  PULSE_MIN_SCALE,
} from "./constants.js";
import { SpriteDepthPlugin } from "./sprite-depth-plugin.js";

export type { SemiInvulnerableDisplay };

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
 * PMDCollab directional atlas. The animation state machine, frame indexing and all
 * timer phase math live in the engine-agnostic `PmdAnimationController`
 * (presentation, plan 126); this class is the Babylon shell that owns the meshes,
 * the X-ray silhouette + foot-depth plugin (Babylon-only) and writes the
 * controller's per-tick outputs (frame UV, plane scale, emissive tint, wobble roll)
 * onto them.
 *
 * Gotcha applied (spike 063):
 * - UV computed in the flipped (`invertY`) space: `vOffset = 1 - (y + h) / atlasH`.
 * - `transparencyMode = ALPHATEST` + `alphaCutOff = 0.5` so the sprite still
 *   writes to the depth buffer (occlusion) while keeping crisp pixel edges.
 */
export class DirectionalBillboard {
  readonly root: TransformNode;
  readonly worldFacing: { value: number };

  private readonly controller: PmdAnimationController;
  private readonly spritePivot: TransformNode;
  private readonly plane: Mesh;
  private readonly material: StandardMaterial;
  private baseAtlas: AtlasBundle | null = null;
  private substituteAtlas: AtlasBundle | null = null;
  private substituteActive = false;
  private activeTexture!: Texture;
  private readonly shadow: Mesh;
  private readonly shadowMaterial: StandardMaterial;
  /** Flattens the sprite's depth to its foot point (native occlusion without self-clip). */
  private readonly depthPlugin: SpriteDepthPlugin;
  /** Team-coloured X-ray plane drawn only where the sprite is occluded by terrain. */
  private readonly silhouettePlane: Mesh;
  private readonly silhouetteMaterial: StandardMaterial;
  private readonly silhouetteDepthPlugin: SpriteDepthPlugin;
  /** True for the duration of an attack lunge — biases foot depth nearer (Babylon depth only). */
  private attacking = false;
  /** Reused emissive colour, mutated each tick from the controller tint (no per-tick alloc). */
  private readonly emissiveScratch = new Color3(1, 1, 1);

  get direction(): PmdDirection {
    return this.controller.direction;
  }

  constructor(private readonly options: DirectionalBillboardOptions) {
    this.controller = new PmdAnimationController(
      {
        frameDurationMs: options.frameDurationMs ?? BABYLON_DEFAULT_FRAME_DURATION_MS,
        tickDurationMs: BABYLON_PMD_TICK_DURATION_MS,
        defaultFrameTicks: BABYLON_PMD_DEFAULT_FRAME_TICKS,
        pulsePeriodMs: BABYLON_PULSE_PERIOD_MS,
        pulseMinScale: PULSE_MIN_SCALE,
        pulseMaxScale: PULSE_MAX_SCALE,
        flashDurationMs: DAMAGE_FLASH_DURATION_MS,
        flashRepeat: DAMAGE_FLASH_REPEAT,
        damageFlashDimLevel: BABYLON_DAMAGE_FLASH_DIM_EMISSIVE,
        previewFlashPeriodMs: BABYLON_PREVIEW_FLASH_PERIOD_MS,
        previewFlashDimLevel: BABYLON_PREVIEW_FLASH_DIM_EMISSIVE,
        confusionWobblePeriodMs: BABYLON_CONFUSION_WOBBLE_PERIOD_MS,
        confusionWobbleAngle: BABYLON_CONFUSION_WOBBLE_ANGLE,
        semiInvulnerableLift: BABYLON_SEMI_INVULNERABLE_LIFT,
        spriteGroundOffsetPx: BABYLON_SPRITE_GROUND_OFFSET_PX,
        hudAnchorMarginPx: BABYLON_HUD_ANCHOR_MARGIN_PX,
        koTintColor: KO_TINT_COLOR,
      },
      {
        animation: options.animation,
        worldFacing: options.worldFacing,
        pixelsPerWorldUnit: options.pixelsPerWorldUnit,
      },
    );
    this.worldFacing = this.controller.worldFacing;

    this.root = new TransformNode("pokemon_root", options.scene);

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
    // Native occlusion against the terrain depth (group 2). `SpriteDepthPlugin`
    // flattens the whole sprite to its foot-point depth, so taller terrain in front
    // occludes it while its own tile, shadow and equal-height neighbours never clip it.
    this.plane.renderingGroupId = BABYLON_SPRITE_RENDERING_GROUP;
    this.depthPlugin = new SpriteDepthPlugin(this.material);

    // Flat ground shadow disc under the sprite. Sits just above the tile top.
    this.shadowMaterial = new StandardMaterial("pokemon_shadow_mat", options.scene);
    this.shadowMaterial.diffuseColor = new Color3(0, 0, 0);
    this.shadowMaterial.emissiveColor = new Color3(0, 0, 0);
    this.shadowMaterial.disableLighting = true;
    this.shadowMaterial.alpha = BABYLON_SHADOW_ALPHA;
    this.shadow = MeshBuilder.CreateDisc("pokemon_shadow", { radius: 1 }, options.scene);
    this.shadow.material = this.shadowMaterial;
    this.shadow.rotation.x = Math.PI / 2;
    this.shadow.position.y = BABYLON_SHADOW_GROUND_OFFSET;
    this.shadow.isPickable = false;
    this.shadow.parent = this.root;
    this.shadow.scaling.set(BABYLON_SHADOW_RADIUS_DEFAULT, BABYLON_SHADOW_RADIUS_DEFAULT, 1);
    // Draw the shadow before tall-grass (transparent sort) so same-tile grass covers
    // it. The shadow keeps its geometry depth (NOT flattened to the sprite foot depth).
    this.shadow.alphaIndex = BABYLON_SHADOW_ALPHA_INDEX;

    // X-ray silhouette: a twin plane sharing the atlas texture, painted flat in the
    // team colour. `depthFunction = GREATER` + no depth write draws it ONLY where the
    // sprite sits behind terrain, so units stay readable behind cliffs/walls.
    const team = options.teamColor ?? 0xffffff;
    this.silhouetteMaterial = new StandardMaterial("pokemon_silhouette_mat", options.scene);
    this.silhouetteMaterial.diffuseColor = new Color3(0, 0, 0);
    this.silhouetteMaterial.emissiveColor = Color3.FromInts(
      (team >> 16) & 0xff,
      (team >> 8) & 0xff,
      team & 0xff,
    );
    this.silhouetteMaterial.disableLighting = true;
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
    this.controller.resolveRestingFallback();
    this.applyFrame();
  }

  /**
   * Loads one PMD atlas (texture + indexed frames + offsets) into a self-contained
   * bundle. Used for both the real sprite (on `load`) and the lazily-loaded Clonage
   * doll, so each can be displayed by swapping the active bundle.
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
    const framesByKey = indexFramesByDirection(json);
    synthesizeFlyingIdle(framesByKey);
    const offsets = await this.loadOffsets(urls.offsetsUrl);
    return {
      texture,
      framesByKey,
      durationsByAnimation: indexAtlasDurations(json.meta.animations),
      atlasWidth: size.width,
      atlasHeight: size.height,
      footOffsetY: offsets.footOffsetY,
      headOffsetY: offsets.headOffsetY,
      shadowRadius: offsets.shadowRadius,
    };
  }

  /** Point the displayed texture + controller atlas index + silhouette + shadow at `bundle`. */
  private bindActiveAtlas(bundle: AtlasBundle): void {
    this.activeTexture = bundle.texture;
    this.material.diffuseTexture = bundle.texture;
    this.silhouetteMaterial.opacityTexture = bundle.texture;
    this.shadow.scaling.set(bundle.shadowRadius, bundle.shadowRadius, 1);
    this.controller.bindAtlas({
      framesByKey: bundle.framesByKey,
      durationsByAnimation: bundle.durationsByAnimation,
      atlasWidth: bundle.atlasWidth,
      atlasHeight: bundle.atlasHeight,
      footOffsetY: bundle.footOffsetY,
      headOffsetY: bundle.headOffsetY,
    });
  }

  /**
   * Loads PMD offsets.json: the per-sprite grounding data (`headOffsetY`,
   * `footOffsetY`) and `shadowSize`. The same fields the Phaser renderer used.
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
      const parsed: unknown = await response.json();
      if (typeof parsed !== "object" || parsed === null) {
        return defaults;
      }
      const offsets = parsed as {
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

  hasAnimation(animation: string): boolean {
    return this.controller.hasAnimation(animation);
  }

  animationDurationMs(animation: string): number {
    return this.controller.animationDurationMs(animation);
  }

  /**
   * Clonage (substitute): swap the displayed sprite to the shared `dummy` doll while
   * the volatile is up, and back to the real sprite when it breaks. The doll atlas is
   * loaded once on first use.
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
    const target = this.substituteActive ? this.substituteAtlas : this.baseAtlas;
    if (!target) {
      return;
    }
    this.bindActiveAtlas(target);
    this.controller.resolveRestingFallback();
    this.applyFrame();
  }

  setAnimation(animation: string): void {
    if (this.controller.setAnimation(animation)) {
      this.applyFrame();
    }
  }

  setRestingAnimation(animation: string): void {
    this.controller.setRestingAnimation(animation);
  }

  playOnce(animation: string, options: { freeze?: boolean; onComplete?: () => void } = {}): void {
    this.controller.playOnce(animation, options);
    this.applyFrame();
  }

  playFirstAvailable(candidates: readonly string[], fallback: string): string {
    const chosen = this.controller.playFirstAvailable(candidates, fallback);
    this.applyFrame();
    return chosen;
  }

  setWorldFacing(angleRadians: number): void {
    this.controller.setWorldFacing(angleRadians);
  }

  setPixelsPerWorldUnit(value: number): void {
    this.controller.setPixelsPerWorldUnit(value);
    this.applyFrame();
  }

  setActive(active: boolean): void {
    this.controller.setActive(active);
    this.applyTransform();
  }

  flashDamage(): void {
    if (this.controller.flashDamage()) {
      this.applyFrame();
    }
  }

  setPreviewFlash(active: boolean): void {
    this.controller.setPreviewFlash(active);
    if (!active) {
      this.applyTint();
    }
  }

  setConfusionWobble(active: boolean): void {
    this.controller.setConfusionWobble(active);
    if (!active) {
      this.plane.rotation.z = 0;
    }
  }

  setKnockedOut(knockedOut: boolean): void {
    const playFaint = this.controller.setKnockedOut(knockedOut);
    this.applyTint();
    // Hide the ground shadow on KO (parity with Phaser): a fainted Pokémon no longer casts one.
    this.shadow.setEnabled(!knockedOut);
    if (playFaint) {
      this.applyFrame();
    }
  }

  setSemiInvulnerable(state: SemiInvulnerableDisplay): void {
    const { hidden } = this.controller.setSemiInvulnerable(state);
    this.plane.setEnabled(!hidden);
    this.silhouettePlane.setEnabled(!hidden);
    this.applyFrame();
  }

  /**
   * Mark an attack lunge: biases the foot depth nearer (see updateFootDepth) so a
   * coplanar front tile no longer clips the enlarged frame.
   */
  setAttacking(active: boolean): void {
    this.attacking = active;
  }

  update(deltaMs: number, cameraAzimuth: number, viewProjection: Matrix): void {
    const { frameChanged } = this.controller.tick(deltaMs, cameraAzimuth);
    if (frameChanged) {
      this.applyFrame();
    }
    this.applyTransform();
    this.applyTint();
    this.plane.rotation.z = this.controller.wobbleRoll();
    this.updateFootDepth(viewProjection);
  }

  /** Re-applies plane + silhouette scale (frame size × active pulse) and Y (foot lift + flying lift). */
  private applyTransform(): void {
    const pulse = this.controller.pulseScale();
    const width = this.controller.frameWorldWidth * pulse;
    const height = this.controller.frameWorldHeight * pulse;
    this.plane.scaling.set(width, height, 1);
    this.silhouettePlane.scaling.set(width, height, 1);
    const baseY = this.controller.footLiftY();
    this.plane.position.y = baseY;
    this.silhouettePlane.position.y = baseY;
  }

  /** Write the controller's current tint multiplier onto the unlit emissive colour. */
  private applyTint(): void {
    const tint = this.controller.tint();
    this.emissiveScratch.set(tint.r, tint.g, tint.b);
    this.material.emissiveColor = this.emissiveScratch;
  }

  /** Point the texture at the current frame sub-rect (V flipped) and refresh the size. */
  private applyFrame(): void {
    const uv = this.controller.frameUv();
    if (!uv) {
      return;
    }
    this.activeTexture.uOffset = uv.uOffset;
    this.activeTexture.vOffset = uv.vOffset;
    this.activeTexture.uScale = uv.uScale;
    this.activeTexture.vScale = uv.vScale;
    this.controller.refreshFrameMetrics();
    this.applyTransform();
  }

  /**
   * Projects the sprite's foot (its root = tile-top centre) to window-space depth
   * and feeds it to both depth plugins, so the whole billboard depth-sorts as a flat
   * token standing on its tile. An attack lunge biases it nearer (not past one height
   * step, so taller tiles still occlude).
   */
  private updateFootDepth(viewProjection: Matrix): void {
    const ndc = Vector3.TransformCoordinates(this.root.position, viewProjection);
    const bias = BABYLON_SPRITE_DEPTH_BIAS + (this.attacking ? BABYLON_ATTACK_DEPTH_BIAS : 0);
    const footDepth = Math.min(1, Math.max(0, 0.5 * ndc.z + 0.5 - bias));
    this.depthPlugin.footDepth = footDepth;
    this.silhouetteDepthPlugin.footDepth = footDepth;
  }

  /** Y offset (world units) from the root to the top of the current sprite frame, for HUD anchoring. */
  get spriteTopOffsetY(): number {
    return this.controller.spriteTopOffsetY;
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
}
