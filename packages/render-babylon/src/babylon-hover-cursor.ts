import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import {
  BABYLON_HOVER_CURSOR_RENDERING_GROUP,
  BABYLON_SPRITE_PIXELS_PER_UNIT,
} from "./babylon-constants.js";
import { HOVER_CURSOR_OPTIONS } from "./constants.js";

const CURSOR_TEXTURE_BASE = "/assets/ui/cursor";
/** localStorage key for the chosen variant. Babylon-only until the settings store is unified with Phaser. */
const CURSOR_VARIANT_STORAGE_KEY = "babylon-hover-cursor-variant";
/** Idle bob (FFTA-style "alive" cursor): vertical oscillation, world units of travel + period. */
const CURSOR_BOB_AMPLITUDE = 2.5 / BABYLON_SPRITE_PIXELS_PER_UNIT;
const CURSOR_BOB_PERIOD_MS = 1000;

/**
 * FFTA selection cursor: a camera-facing 2D billboard floating above the hovered
 * tile, lifted to the Pokémon head when one stands there. 4 cyclable variants
 * (H key), drawn on a dedicated rendering group so it always reads on top.
 */
export class BabylonHoverCursor {
  private readonly root: TransformNode;
  private readonly plane: Mesh;
  private readonly material: StandardMaterial;
  /** Sparse: one cached texture per visited variant index, swapped into the shared material on cycle. */
  private readonly textures: (Texture | undefined)[] = [];
  private variantIndex = 0;
  /** Base head Y (set on showAt); the bob oscillates the root around it. */
  private bobBaseY = 0;
  private bobElapsedMs = 0;
  private readonly bobObserver: Observer<Scene>;

  constructor(scene: Scene) {
    this.root = new TransformNode("hover_cursor_root", scene);
    this.root.setEnabled(false);

    // Idle bob: oscillate the root's Y around the head point while visible, so the
    // cursor feels alive (replaces the Phaser cursor's alpha pulse with a motion
    // better suited to a floating FFTA cursor).
    this.bobObserver = scene.onBeforeRenderObservable.add(() => {
      if (!this.root.isEnabled()) {
        return;
      }
      this.bobElapsedMs =
        (this.bobElapsedMs + scene.getEngine().getDeltaTime()) % CURSOR_BOB_PERIOD_MS;
      const phase = (2 * Math.PI * this.bobElapsedMs) / CURSOR_BOB_PERIOD_MS;
      this.root.position.y = this.bobBaseY + CURSOR_BOB_AMPLITUDE * Math.sin(phase);
    });

    this.plane = MeshBuilder.CreatePlane("hover_cursor", { size: 1 }, scene);
    this.plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.plane.parent = this.root;
    this.plane.isPickable = false;
    this.plane.renderingGroupId = BABYLON_HOVER_CURSOR_RENDERING_GROUP;

    this.material = new StandardMaterial("hover_cursor_mat", scene);
    this.material.emissiveColor = new Color3(1, 1, 1);
    this.material.disableLighting = true;
    this.material.specularColor = new Color3(0, 0, 0);
    this.material.useAlphaFromDiffuseTexture = true;
    this.plane.material = this.material;

    this.variantIndex = this.readStoredVariant();
    this.applyVariant();
  }

  /** Float the cursor at a world point (the hovered Pokémon's head + gap). */
  showAt(headWorld: Vector3): void {
    this.root.position.copyFrom(headWorld);
    this.bobBaseY = headWorld.y;
    this.root.setEnabled(true);
  }

  hide(): void {
    this.root.setEnabled(false);
  }

  /** Cycle to the next cursor variant (H key) and persist the choice. */
  cycleVariant(): void {
    this.variantIndex = (this.variantIndex + 1) % HOVER_CURSOR_OPTIONS.length;
    this.applyVariant();
    this.storeVariant();
  }

  dispose(): void {
    this.root.getScene().onBeforeRenderObservable.remove(this.bobObserver);
    this.material.dispose();
    for (const texture of this.textures) {
      texture?.dispose();
    }
    this.plane.dispose();
    this.root.dispose();
  }

  private texture(index: number): Texture {
    const cached = this.textures[index];
    if (cached) {
      return cached;
    }
    const option = HOVER_CURSOR_OPTIONS[index];
    if (!option) {
      throw new Error(`No hover cursor variant at index ${index}`);
    }
    const texture = new Texture(
      `${CURSOR_TEXTURE_BASE}/${option.key}.png`,
      this.root.getScene(),
      true,
      true,
      Texture.NEAREST_SAMPLINGMODE,
    );
    texture.hasAlpha = true;
    this.textures[index] = texture;
    return texture;
  }

  /** Swap to the active variant's texture and size the plane to its pixels (scaled). */
  private applyVariant(): void {
    const option = HOVER_CURSOR_OPTIONS[this.variantIndex];
    if (!option) {
      return;
    }
    const texture = this.texture(this.variantIndex);
    this.material.diffuseTexture = texture;
    const resize = (): void => {
      const size = texture.getBaseSize();
      if (size.height === 0) {
        return;
      }
      const worldHeight = (size.height * option.scale) / BABYLON_SPRITE_PIXELS_PER_UNIT;
      const worldWidth = worldHeight * (size.width / size.height);
      this.plane.scaling.set(worldWidth, worldHeight, 1);
      // Anchor the cursor tip (bottom of the PNG) at the root: lift the centred
      // plane by half its height so it hangs above the head, pointing down.
      this.plane.position.y = worldHeight / 2;
    };
    if (texture.isReady()) {
      resize();
    } else {
      texture.onLoadObservable.addOnce(resize);
    }
  }

  private readStoredVariant(): number {
    const raw = Number.parseInt(localStorage.getItem(CURSOR_VARIANT_STORAGE_KEY) ?? "", 10);
    return Number.isInteger(raw) && raw >= 0 && raw < HOVER_CURSOR_OPTIONS.length ? raw : 0;
  }

  private storeVariant(): void {
    localStorage.setItem(CURSOR_VARIANT_STORAGE_KEY, String(this.variantIndex));
  }
}
