import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { loadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Material } from "@babylonjs/core/Materials/material";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import type { SemiInvulnerableDisplay } from "@pokemon-tactic/view-core";
// Side-effect: registers the glTF 2.0 loader used by loadAssetContainerAsync.
import "@babylonjs/loaders/glTF/2.0";
import type { PokemonActor } from "./pokemon-actor.js";

/**
 * Uniform scale applied to the GLB. Cobblemon authors models at real Pokédex scale
 * (1 block ≈ 1 m) with a per-species `baseScale` (Venusaur 1.2) → ~2.8 blocks tall and
 * a 2.2-block-wide hitbox in-game. Our grid is one tile per Pokémon (a hard core
 * invariant — multi-tile footprints are out of scope), so we shrink the model to fit
 * roughly one tile by its hitbox width (2.2 → 1): a flat factor. Bind-pose outliers
 * (Venusaur's extended vines reach ±3.4 blocks) overhang and tuck in once animated.
 * One factor for now — refine per-species once more models are converted.
 */
const GLB_MODEL_SCALE = 0.45;

/**
 * Maps the renderer's sprite-animation vocabulary onto Cobblemon clip-name fragments
 * (`animation.<species>.<clip>`). Resolution is substring + case-insensitive so it
 * works whether Blender exports the full clip name or just the suffix. First match wins.
 */
const ANIMATION_ALIASES: Record<string, readonly string[]> = {
  Idle: ["ground_idle", "battle_idle", "idle"],
  Walk: ["ground_walk", "walk"],
  Run: ["ground_run", "run"],
  Hurt: ["recoil", "hurt"],
  Faint: ["faint"],
  Sleep: ["sleep"],
};

export interface GlbPokemonActorOptions {
  scene: Scene;
  /** URL of the converted Cobblemon GLB (gitignored asset, see plan 129). */
  glbUrl: string;
  worldFacing: number;
}

/**
 * Renders one Pokémon as a Cobblemon 3D model (GLB) instead of a PMD billboard
 * (plan 129, temps 2). A real mesh, so it depth-sorts against the voxel terrain
 * natively (rendering group 0) and faces a fixed world direction rather than the
 * camera. Implements the same {@link PokemonActor} contract the combat loop drives;
 * the state-machine visual effects that have no 3D analogue yet (substitute doll,
 * confusion wobble, preview flash, semi-invuln) are best-effort no-ops for the POC.
 */
export class GlbPokemonActor implements PokemonActor {
  readonly root: TransformNode;
  readonly worldFacing: { value: number };

  private readonly scene: Scene;
  private readonly glbUrl: string;
  private model: TransformNode | null = null;
  private readonly animationsByName = new Map<string, AnimationGroup>();
  private currentAnimation: AnimationGroup | null = null;
  private restingAnimation = "Idle";
  private topOffsetY = 0;
  private disposed = false;

  constructor(options: GlbPokemonActorOptions) {
    this.scene = options.scene;
    this.glbUrl = options.glbUrl;
    this.worldFacing = { value: options.worldFacing };
    this.root = new TransformNode("pokemon_glb_root", options.scene);
    this.applyFacing();
  }

  async load(): Promise<void> {
    const container = await loadAssetContainerAsync(this.glbUrl, this.scene);
    if (this.disposed || this.scene.isDisposed) {
      container.dispose();
      return;
    }
    container.addAllToScene();

    const model = new TransformNode("pokemon_glb_model", this.scene);
    model.parent = this.root;
    model.scaling.setAll(GLB_MODEL_SCALE);
    for (const node of container.rootNodes) {
      // glTF import wraps content under a `__root__` space-conversion node; reparent
      // whatever the loader produced under our model node so facing/scale apply once.
      node.parent = model;
    }
    this.model = model;

    for (const mesh of container.meshes) {
      mesh.isPickable = false;
      sharpenPixelTextures(mesh);
      if (mesh.material) {
        // The converter exports alphaMode BLEND; pixel art wants a hard cutout
        // (ALPHATEST). BLEND skips the depth write, so faces sort wrong and read as
        // transparent (see-through paws / vanished face). ALPHATEST writes depth →
        // correct occlusion + crisp edges (mirrors the sprite renderer rule).
        applyPixelCutout(mesh.material);
        // Bedrock cubes export with inconsistent winding/normals, so backface culling
        // punches holes (you see into the head). Render both sides to fill them.
        mesh.material.backFaceCulling = false;
      }
    }
    // Cobblemon stops every clip on a held frame at load; capture them by name, then
    // resolve idle so a freshly-spawned model is alive rather than T-posed.
    for (const group of container.animationGroups) {
      group.stop();
      this.animationsByName.set(group.name, group);
    }

    // Centre the model on its tile. The geo origin sits wherever the artist placed it
    // (Venusaur's is on its face) and the bounding box is skewed by the flower/vines, so
    // neither is the real stance point. Cobblemon ships foot locators (`locator_foot_*`)
    // that survive the GLB export — their XZ centroid is exactly where the Pokémon
    // stands. Neutralise the facing rotation + tile placement first (so world coords ==
    // model-local; load() is async and may run after the scene placed root on its tile),
    // recentre XZ on the stance point, then restore the transform. Y is left at the
    // GLB's native origin (Cobblemon authors feet at y≈0 → lands on the tile top).
    const savedYaw = this.root.rotation.y;
    const savedPosition = this.root.position.clone();
    this.root.rotation.y = 0;
    this.root.position.setAll(0);
    this.root.computeWorldMatrix(true);
    const center = stanceCenter(container.transformNodes) ?? boundsCenter(container.meshes);
    if (center) {
      model.position.x -= center.x;
      model.position.z -= center.z;
    }
    const bounds = measureBounds(container.meshes);
    if (bounds) {
      this.topOffsetY = bounds.maxY;
    }
    this.root.rotation.y = savedYaw;
    this.root.position.copyFrom(savedPosition);
    this.root.computeWorldMatrix(true);
    this.setAnimation(this.restingAnimation);
  }

  update(_deltaMs: number, _cameraAzimuth: number, _viewProjection: Matrix): void {
    // Real 3D mesh: Babylon's depth buffer sorts it against the terrain, and Babylon
    // advances its own AnimationGroups — nothing to drive per frame yet.
  }

  setWorldFacing(angleRadians: number): void {
    this.worldFacing.value = angleRadians;
    this.applyFacing();
  }

  private applyFacing(): void {
    // worldFacing is an XZ angle whose direction vector is (cos θ, sin θ) in (x, z)
    // (sprite-facing.ts: South=+X, East=+Z, North=-X, West=-Z). The imported model faces
    // local +Z, and a Babylon Y-yaw φ sends +Z to (sin φ, cos φ) — so aligning the two
    // gives φ = π/2 - θ (the model yaws opposite to the facing angle, not a flat offset).
    this.root.rotation.y = Math.PI / 2 - this.worldFacing.value;
  }

  /** Resolve a sprite-vocabulary animation name to a loaded Cobblemon clip. */
  private resolve(animation: string): AnimationGroup | null {
    const direct = this.animationsByName.get(animation);
    if (direct) {
      return direct;
    }
    const fragments = ANIMATION_ALIASES[animation] ?? [animation.toLowerCase()];
    for (const fragment of fragments) {
      for (const [name, group] of this.animationsByName) {
        if (name.toLowerCase().includes(fragment)) {
          return group;
        }
      }
    }
    return null;
  }

  hasAnimation(animation: string): boolean {
    return this.resolve(animation) !== null;
  }

  animationDurationMs(animation: string): number {
    const group = this.resolve(animation);
    if (!group) {
      return 0;
    }
    const fps = group.targetedAnimations[0]?.animation.framePerSecond ?? 30;
    return ((group.to - group.from) / fps) * 1000;
  }

  setAnimation(animation: string): void {
    const group = this.resolve(animation);
    if (!group || group === this.currentAnimation) {
      return;
    }
    this.currentAnimation?.stop();
    group.start(true);
    this.currentAnimation = group;
  }

  setRestingAnimation(animation: string): void {
    this.restingAnimation = animation;
  }

  playOnce(animation: string, options: { freeze?: boolean; onComplete?: () => void } = {}): void {
    const group = this.resolve(animation);
    if (!group) {
      options.onComplete?.();
      return;
    }
    this.currentAnimation?.stop();
    group.start(false);
    this.currentAnimation = group;
    group.onAnimationGroupEndObservable.addOnce(() => {
      options.onComplete?.();
      if (!options.freeze) {
        this.setAnimation(this.restingAnimation);
      }
    });
  }

  playFirstAvailable(candidates: readonly string[], fallback: string): string {
    for (const candidate of candidates) {
      if (this.hasAnimation(candidate)) {
        this.setAnimation(candidate);
        return candidate;
      }
    }
    this.setAnimation(fallback);
    return fallback;
  }

  setActive(_active: boolean): void {
    // No active-turn pulse for 3D models (the sprite pulse is a billboard affordance).
  }

  setKnockedOut(knockedOut: boolean): void {
    if (knockedOut && this.hasAnimation("Faint")) {
      this.playOnce("Faint", { freeze: true });
    }
  }

  async setSubstitute(active: boolean): Promise<void> {
    // No doll model yet — just hide the real mesh while the substitute is up.
    this.model?.setEnabled(!active);
  }

  flashDamage(): void {
    // POC: no hit-flash on the 3D model yet (sprite flashes its emissive tint).
  }
  setPreviewFlash(_active: boolean): void {
    // POC: no targeting preview pulse on the 3D model yet.
  }
  setConfusionWobble(_active: boolean): void {
    // POC: no confusion wobble on the 3D model yet.
  }
  setSemiInvulnerable(state: SemiInvulnerableDisplay): void {
    // Underground (Dig/Burrow) hides the model; flying stays visible (POC).
    this.model?.setEnabled(state !== "underground");
  }
  setAttacking(_active: boolean): void {
    // POC: no lunge depth-bias needed — the 3D model depth-sorts natively.
  }

  get spriteTopOffsetY(): number {
    return this.topOffsetY;
  }

  dispose(): void {
    this.disposed = true;
    for (const group of this.animationsByName.values()) {
      group.dispose();
    }
    this.root.dispose(false, true);
  }
}

/** Matches Cobblemon foot locator bones; their XZ centroid is the model's stance point. */
const FOOT_LOCATOR = /^locator_foot/i;
/** Fallback single locator at the model's intended horizontal centre. */
const MIDDLE_LOCATOR = "locator_middle";

/**
 * Stance centre (XZ, model-local) from Cobblemon foot locators — the authoritative
 * "where it stands" metadata, robust to the bounding box being skewed by the flower,
 * vines or an off-centre geo pivot. Falls back to `locator_middle`, then null.
 */
function stanceCenter(nodes: readonly TransformNode[]): { x: number; z: number } | null {
  const feet = nodes.filter((node) => FOOT_LOCATOR.test(node.name));
  if (feet.length > 0) {
    let x = 0;
    let z = 0;
    for (const node of feet) {
      node.computeWorldMatrix(true);
      const position = node.getAbsolutePosition();
      x += position.x;
      z += position.z;
    }
    return { x: x / feet.length, z: z / feet.length };
  }
  const middle = nodes.find((node) => node.name === MIDDLE_LOCATOR);
  if (middle) {
    middle.computeWorldMatrix(true);
    const position = middle.getAbsolutePosition();
    return { x: position.x, z: position.z };
  }
  return null;
}

/** XZ centre of the model's bounding box — last-resort centring when no locators exist. */
function boundsCenter(meshes: readonly AbstractMesh[]): { x: number; z: number } | null {
  const bounds = measureBounds(meshes);
  if (!bounds) {
    return null;
  }
  return { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
}

/** Switch a GLB material to hard alpha cutout (pixel-art sprites: depth-writing, crisp). */
function applyPixelCutout(material: Material): void {
  material.transparencyMode = Material.MATERIAL_ALPHATEST;
  if (material instanceof PBRMaterial) {
    material.alphaCutOff = 0.5;
    if (material.albedoTexture) {
      material.albedoTexture.hasAlpha = true;
    }
  }
}

/** Force NEAREST sampling on every texture of a mesh — keep the Cobblemon pixel art crisp. */
function sharpenPixelTextures(mesh: AbstractMesh): void {
  const material = mesh.material;
  if (!material) {
    return;
  }
  for (const texture of material.getActiveTextures()) {
    if (texture instanceof Texture) {
      texture.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
    }
  }
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

/** World-space AABB over every renderable mesh (root at origin → world == model-local). */
function measureBounds(meshes: readonly AbstractMesh[]): Bounds | null {
  let bounds: Bounds | null = null;
  for (const mesh of meshes) {
    if (mesh.getTotalVertices() === 0) {
      continue;
    }
    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo({ applySkeleton: true });
    const box = mesh.getBoundingInfo().boundingBox;
    const min = box.minimumWorld;
    const max = box.maximumWorld;
    if (!bounds) {
      bounds = { minX: min.x, maxX: max.x, minY: min.y, maxY: max.y, minZ: min.z, maxZ: max.z };
      continue;
    }
    bounds.minX = Math.min(bounds.minX, min.x);
    bounds.maxX = Math.max(bounds.maxX, max.x);
    bounds.minY = Math.min(bounds.minY, min.y);
    bounds.maxY = Math.max(bounds.maxY, max.y);
    bounds.minZ = Math.min(bounds.minZ, min.z);
    bounds.maxZ = Math.max(bounds.maxZ, max.z);
  }
  return bounds;
}
