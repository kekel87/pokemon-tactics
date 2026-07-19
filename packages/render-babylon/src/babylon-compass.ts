import type { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import { loadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import { voxelWorldSize } from "@pokemon-tactic/view-core";
// Side-effect: registers the glTF 2.0 loader used by loadAssetContainerAsync.
import "@babylonjs/loaders/glTF/2.0";
import {
  BABYLON_HUD_RENDERING_GROUP,
  BABYLON_SPRITE_PIXELS_PER_UNIT,
} from "./babylon-constants.js";

/** Voxel compass authored in voxigen.io (assets-src/voxel/compass.vxb), exported as glb. */
const COMPASS_GLB_URL = "assets/ui/compass.glb";
/** Left inset as a fraction of the ortho extent (from the left edge). */
const COMPASS_LEFT_FRACTION = 0.055;
/** Top inset as a fraction of the ortho extent — small, so it rides at the active-portrait level. */
const COMPASS_TOP_FRACTION = 0.035;
/** Depth in front of the camera to park the compass (between minZ and maxZ). */
const COMPASS_CAMERA_DEPTH = 20;
/** Fixed world spin so the model's red North marker reads as world-North (calibrated to the view). */
const COMPASS_NORTH_OFFSET = Math.PI / 2;

/**
 * Always-on map compass. A real scene mesh (compass.glb) pinned to the top-left screen corner every
 * frame, but kept at a FIXED world rotation — so as the isometric camera orbits (←/→), the compass
 * appears to turn exactly like the map tiles, its North needle always pointing world-North on screen.
 * Drawn on the HUD rendering group so it reads on top. The glb loads async; pinning starts once ready.
 */
export class BabylonCompass {
  private readonly root: TransformNode;
  private mesh: Mesh | null = null;
  private readonly observer: Observer<Scene>;
  private disposed = false;

  constructor(scene: Scene, camera: TargetCamera) {
    this.root = new TransformNode("compass_root", scene);
    // Fixed world rotation: the orbiting camera does the visual turning (parity with the tiles); the
    // constant North offset just aligns the model's needle with true world-North.
    this.root.rotationQuaternion = null;
    this.root.rotation.y = COMPASS_NORTH_OFFSET;

    this.observer = scene.onBeforeRenderObservable.add(() => {
      if (this.disposed || !this.mesh) {
        return;
      }
      this.pinToCorner(camera);
    });

    void loadAssetContainerAsync(COMPASS_GLB_URL, scene)
      .then((container) => {
        if (this.disposed || scene.isDisposed) {
          container.dispose();
          return;
        }
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
        merged.name = "compass";
        this.normalizeMesh(merged);
        this.replaceWithStandardMaterial(merged, scene);
        merged.hasVertexAlpha = false;
        merged.parent = this.root;
        merged.isPickable = false;
        merged.renderingGroupId = BABYLON_HUD_RENDERING_GROUP;
        this.mesh = merged;
        for (const node of container.rootNodes) {
          if (node !== merged) {
            node.dispose();
          }
        }
      })
      .catch((error) => {
        // biome-ignore lint/suspicious/noConsole: surfacing a fatal compass-asset load failure
        console.error("Failed to load compass", COMPASS_GLB_URL, error);
      });
  }

  dispose(): void {
    this.disposed = true;
    this.root.getScene().onBeforeRenderObservable.remove(this.observer);
    this.root.dispose(false, true);
  }

  /** Park the compass at the top-left screen corner in front of the ortho camera (per frame). */
  private pinToCorner(camera: TargetCamera): void {
    const orthoTop = camera.orthoTop ?? 1;
    const orthoLeft = camera.orthoLeft ?? -1;
    // Offset each axis by a fraction of its OWN ortho span so the screen position stays constant
    // across aspect ratios / resolutions (using the vertical span for the horizontal offset would
    // make the corner drift as the window widens).
    const horizontalSpan = (camera.orthoRight ?? 1) - orthoLeft;
    const verticalSpan = orthoTop - (camera.orthoBottom ?? -1);
    const right = camera.getDirection(Vector3.Right());
    const up = camera.getDirection(Vector3.Up());
    const forward = camera.getDirection(Vector3.Forward());
    const x = orthoLeft + horizontalSpan * COMPASS_LEFT_FRACTION;
    const y = orthoTop - verticalSpan * COMPASS_TOP_FRACTION;
    this.root.position
      .copyFrom(camera.position)
      .addInPlace(forward.scale(COMPASS_CAMERA_DEPTH))
      .addInPlace(right.scale(x))
      .addInPlace(up.scale(y));
  }

  /** Scale the voxel model at 1 voxel = 1 sprite pixel (parity with the cursor / hazards) + centre it. */
  private normalizeMesh(mesh: Mesh): void {
    mesh.setParent(null);
    mesh.bakeCurrentTransformIntoVertices();
    mesh.scaling.setAll(voxelWorldSize(BABYLON_SPRITE_PIXELS_PER_UNIT));
    mesh.bakeCurrentTransformIntoVertices();
    mesh.refreshBoundingInfo();
    const box = mesh.getBoundingInfo().boundingBox;
    mesh.position.set(-box.center.x, -box.center.y, -box.center.z);
    mesh.bakeCurrentTransformIntoVertices();
    mesh.position.setAll(0);
  }

  private replaceWithStandardMaterial(mesh: Mesh, scene: Scene): void {
    const source = mesh.material;
    const standard = new StandardMaterial("compass", scene);
    standard.disableLighting = true;
    standard.emissiveColor.set(1, 1, 1);
    if (source instanceof PBRMaterial) {
      standard.diffuseColor = source.albedoColor.clone();
      standard.emissiveColor = source.albedoColor.clone();
      standard.diffuseTexture = source.albedoTexture ?? null;
      standard.emissiveTexture = source.albedoTexture ?? null;
    }
    mesh.material = standard;
    source?.dispose();
  }
}
