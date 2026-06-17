import { loadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import { voxelWorldSize } from "@pokemon-tactic/view-core";
// Side-effect: registers the glTF 2.0 loader used by loadAssetContainerAsync.
import "@babylonjs/loaders/glTF/2.0";
import {
  BABYLON_HOVER_CURSOR_RENDERING_GROUP,
  BABYLON_SPRITE_PIXELS_PER_UNIT,
} from "./babylon-constants.js";

/** Voxel cursor authored in voxigen.io, exported as glb (1 voxel per glTF unit). */
const CURSOR_GLTF_URL = "assets/ui/cursor.glb";
/** Idle bob (FFTA-style "alive" cursor): vertical oscillation, world units of travel + period. */
const CURSOR_BOB_AMPLITUDE = 2.5 / BABYLON_SPRITE_PIXELS_PER_UNIT;
const CURSOR_BOB_PERIOD_MS = 1000;

/**
 * FFTA selection cursor: a voxel model (`cursor.glb`) floating above the hovered
 * tile, lifted to the Pokémon head when one stands there. A real scene mesh (not a
 * billboard) so the voxels rotate with the camera like the placement arrows, scaled
 * at 1 voxel = 1 sprite pixel for pixel parity. Drawn on a dedicated rendering group
 * so it always reads on top. The glb loads asynchronously; a `showAt` issued before
 * the load completes is replayed once the mesh is built.
 */
export class BabylonHoverCursor {
  private readonly root: TransformNode;
  private mesh: Mesh | null = null;
  /** Base head Y (set on showAt); the bob oscillates the root around it. */
  private bobBaseY = 0;
  private bobElapsedMs = 0;
  private readonly bobObserver: Observer<Scene>;
  /** showAt requested before the glb finished loading (replayed on build). */
  private pendingHead: Vector3 | null = null;
  private disposed = false;

  constructor(scene: Scene) {
    this.root = new TransformNode("hover_cursor_root", scene);
    this.root.setEnabled(false);

    // Idle bob: oscillate the root's Y around the head point while visible, so the
    // cursor feels alive.
    this.bobObserver = scene.onBeforeRenderObservable.add(() => {
      if (!this.root.isEnabled()) {
        return;
      }
      this.bobElapsedMs =
        (this.bobElapsedMs + scene.getEngine().getDeltaTime()) % CURSOR_BOB_PERIOD_MS;
      const phase = (2 * Math.PI * this.bobElapsedMs) / CURSOR_BOB_PERIOD_MS;
      this.root.position.y = this.bobBaseY + CURSOR_BOB_AMPLITUDE * Math.sin(phase);
    });

    void loadAssetContainerAsync(CURSOR_GLTF_URL, scene)
      .then((container) => {
        // Teardown race: scene disposed while the glb loaded → drop and bail.
        if (this.disposed || scene.isDisposed) {
          container.dispose();
          return;
        }
        // loadAssetContainerAsync leaves meshes detached from the scene; add them so the
        // single-mesh path (used directly, not cloned like the arrows) actually renders.
        container.addAllToScene();
        const geometryMeshes = container.meshes.filter(
          (mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0,
        );
        const merged =
          geometryMeshes.length === 1
            ? geometryMeshes[0]
            : Mesh.MergeMeshes(geometryMeshes, true, true);
        if (!merged) {
          return;
        }
        merged.name = "hover_cursor";
        this.normalizeMesh(merged);
        this.replaceWithStandardMaterial(merged, scene);
        // The voxel ships VEC4 vertex colours (RGBA), so Babylon auto-enables vertex alpha and
        // renders the mesh in the transparent pass — its own back faces show through. The model is
        // fully opaque (material alphaMode OPAQUE), so drop vertex alpha to render it solid.
        merged.hasVertexAlpha = false;
        merged.parent = this.root;
        merged.isPickable = false;
        merged.renderingGroupId = BABYLON_HOVER_CURSOR_RENDERING_GROUP;
        this.mesh = merged;
        // Free the loader's residual nodes (the `__root__` space-conversion node and
        // any leftovers); normalizeMesh already detached the mesh, so it survives.
        for (const node of container.rootNodes) {
          if (node !== merged) {
            node.dispose();
          }
        }
        if (this.pendingHead) {
          this.showAt(this.pendingHead);
          this.pendingHead = null;
        }
      })
      .catch((error) => {
        // biome-ignore lint/suspicious/noConsole: surfacing a fatal cursor-asset load failure
        console.error("Failed to load hover cursor", CURSOR_GLTF_URL, error);
      });
  }

  /** Float the cursor at a world point (the hovered Pokémon's head + gap). */
  showAt(headWorld: Vector3): void {
    if (!this.mesh) {
      this.pendingHead = headWorld.clone();
      return;
    }
    this.root.position.copyFrom(headWorld);
    this.bobBaseY = headWorld.y;
    this.root.setEnabled(true);
  }

  hide(): void {
    this.pendingHead = null;
    this.root.setEnabled(false);
  }

  dispose(): void {
    this.disposed = true;
    this.root.getScene().onBeforeRenderObservable.remove(this.bobObserver);
    this.root.dispose(false, true);
  }

  /**
   * Normalises the imported voxel cursor into a mesh at the origin: bakes the glTF
   * coordinate conversion, scales it to 1 voxel = 1 sprite pixel, recentres it on
   * X/Z and lifts it so its bottom sits at the root (hanging above the head).
   */
  private normalizeMesh(mesh: Mesh): void {
    mesh.setParent(null);
    mesh.bakeCurrentTransformIntoVertices();
    // 1 voxel → 1 sprite pixel (voxigen = 1 voxel per glTF unit), not a fit-to-size scale.
    mesh.scaling.setAll(voxelWorldSize(BABYLON_SPRITE_PIXELS_PER_UNIT));
    mesh.bakeCurrentTransformIntoVertices();
    mesh.refreshBoundingInfo();
    const box = mesh.getBoundingInfo().boundingBox;
    // Recentre X/Z on the tile; lift so the bottom of the model rests at the root.
    mesh.position.set(-box.center.x, box.extendSize.y - box.center.y, -box.center.z);
    mesh.bakeCurrentTransformIntoVertices();
    mesh.position.setAll(0);
  }

  /** Swap the imported PBR material for a flat StandardMaterial (preserving vertex colours), so no
   *  environmentBRDF RGBD texture is loaded (avoids the teardown crash; see direction-picker). */
  private replaceWithStandardMaterial(mesh: Mesh, scene: Scene): void {
    const source = mesh.material;
    const standard = new StandardMaterial("hover_cursor", scene);
    if (source instanceof PBRMaterial) {
      standard.diffuseColor = source.albedoColor.clone();
      standard.diffuseTexture = source.albedoTexture ?? null;
    }
    mesh.material = standard;
    source?.dispose();
  }
}
