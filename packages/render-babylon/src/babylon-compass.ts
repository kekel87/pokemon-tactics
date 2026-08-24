import type { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import { loadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import { voxelWorldSize } from "@pokemon-tactic/view-core";

/**
 * Geometry the compass borrows from the chrome. Declared here rather than imported from `ui-dom`:
 * the renderer must not depend on the DOM chrome package — the host passes plain numbers in.
 */
export interface TimelineFirstCell {
  readonly rightPx: number;
  readonly topPx: number;
  readonly sizePx: number;
}

// Side-effect: registers the glTF 2.0 loader used by loadAssetContainerAsync.
import "@babylonjs/loaders/glTF/2.0";
import {
  BABYLON_HUD_RENDERING_GROUP,
  BABYLON_SPRITE_PIXELS_PER_UNIT,
  BABYLON_VIEW_SIZE,
} from "./babylon-constants.js";

/** Voxel compass authored in voxigen.io (assets-src/voxel/compass.vxb), exported as glb. */
const COMPASS_GLB_URL = "assets/ui/compass.glb";
/** Longest span of the needle mesh, in voxels — what sets its on-screen footprint. */
const COMPASS_MODEL_FOOTPRINT_VOXELS = 17;
/** Touch-target floor (CSS px) the pick box never goes under, whatever the compass' visible size. */
const COMPASS_MIN_HIT_PX = 44;
/** Mesh name of the invisible pick box (`isHit` matches by identity, not by name). */
const COMPASS_PICK_PROXY_NAME = "compass_pick_proxy";
/** Reference render size (px) the fixed position + size are calibrated against (1080p / 1920×1080). */
const COMPASS_REFERENCE_RENDER_HEIGHT = 1080;
const COMPASS_REFERENCE_RENDER_WIDTH = 1920;
/** Left inset as a fraction of the reference width (constant px from the left edge). Higher → right. */
const COMPASS_LEFT_FRACTION = 0.05;
/**
 * On-screen size (CSS px) the needle occupies at scale 1. Falls out of the pinning maths below,
 * where renderHeight and verticalSpan cancel: `REFERENCE_HEIGHT · voxels / VIEW_SIZE`. Used to turn
 * a wanted pixel size into a scale factor.
 *
 * Derived from the MODEL span, never from the pick box: deriving it from the hitbox meant enlarging
 * the tap target silently shrank the drawn compass (two concepts on one constant).
 */
const COMPASS_NATURAL_FOOTPRINT_PX =
  COMPASS_MODEL_FOOTPRINT_VOXELS *
  voxelWorldSize(BABYLON_SPRITE_PIXELS_PER_UNIT) *
  (COMPASS_REFERENCE_RENDER_HEIGHT / BABYLON_VIEW_SIZE);
/** Top inset as a fraction of the reference height (constant px from the top edge). Higher → lower. */
const COMPASS_TOP_FRACTION = 0.034;
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
  /** Invisible, pickable box giving the needle a finger-sized hit area (plan 183). */
  private readonly pickProxy: Mesh;
  private readonly observer: Observer<Scene>;
  private disposed = false;

  /** Geometry of the timeline's first portrait — the compass matches its size and its top-left. */
  private readonly firstCell: () => TimelineFirstCell | null;
  /** Canvas width in CSS px — the scale factor between that measurement and framebuffer pixels. */
  private readonly canvasClientWidth: () => number;

  constructor(
    scene: Scene,
    camera: TargetCamera,
    firstCell: () => TimelineFirstCell | null = () => null,
    canvasClientWidth: () => number = () => camera.getScene().getEngine().getRenderWidth(),
  ) {
    this.firstCell = firstCell;
    this.canvasClientWidth = canvasClientWidth;
    this.root = new TransformNode("compass_root", scene);
    // Fixed world rotation: the orbiting camera does the visual turning (parity with the tiles); the
    // constant North offset just aligns the model's needle with true world-North.
    this.root.rotationQuaternion = null;
    this.root.rotation.y = COMPASS_NORTH_OFFSET;

    /*
     * The needle is 17×5×3 voxels — roughly 59×17 CSS px — so its narrow axis is far under any sane
     * touch target and the mesh is needle-shaped anyway: taps land on a rectangle instead.
     *
     * A screen-aligned PLANE, sized per frame, rather than a cube parented to the root: a cube would
     * spin with the needle (the root holds a fixed world rotation while the camera orbits), so its
     * screen footprint would breathe as the view turned. `BILLBOARDMODE_ALL` keeps the square facing
     * the camera, so its footprint stays exactly what the maths says.
     *
     * Built up-front, not with the glb: the compass answers taps as soon as it is on screen, and a
     * proxy that only appeared after an async load would silently swallow early taps.
     */
    this.pickProxy = CreatePlane(COMPASS_PICK_PROXY_NAME, { size: 1 }, scene);
    this.pickProxy.billboardMode = Mesh.BILLBOARDMODE_ALL;
    // Invisible but pickable: `scene.pick` skips invisible meshes only under its DEFAULT predicate,
    // and `isHit` passes its own — the same trick `pickTile` uses for tile meshes.
    this.pickProxy.isVisible = false;

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

  /**
   * True when a canvas point lands on the compass. The caller resolves this BEFORE tile picking:
   * the compass draws over the board, so without an early exit the ray would carry on and select a
   * tile the player never aimed at. Uses an explicit predicate, which is what makes the invisible
   * proxy pickable at all.
   */
  isHit(scene: Scene, pointerX: number, pointerY: number): boolean {
    // `!this.mesh` matters as much as `disposed`: until the glb lands, `pinToCorner` has not run and
    // the proxy still sits at the world ORIGIN — invisible, pickable, and consulted before tile
    // picking, so a tap mid-board would rotate the camera instead of selecting a tile.
    if (this.disposed || !this.mesh) {
      return false;
    }
    const pick = scene.pick(pointerX, pointerY, (mesh) => mesh === this.pickProxy);
    return pick?.hit === true;
  }

  dispose(): void {
    this.disposed = true;
    this.root.getScene().onBeforeRenderObservable.remove(this.observer);
    this.root.dispose(false, true);
    // Not a child of the root — it must stay screen-aligned while the root spins — so the recursive
    // dispose above never reaches it.
    this.pickProxy.dispose(false, true);
  }

  /** Park the compass at a top-left corner spot with a CONSTANT on-screen pixel size (per frame). */
  private pinToCorner(camera: TargetCamera): void {
    const orthoTop = camera.orthoTop ?? 1;
    const orthoLeft = camera.orthoLeft ?? -1;
    const horizontalSpan = (camera.orthoRight ?? 1) - orthoLeft;
    const verticalSpan = orthoTop - (camera.orthoBottom ?? -1);
    const engine = camera.getScene().getEngine();
    // Guard against a 0×0 canvas (hidden tab): a zero divisor would make every position/scale NaN.
    const renderWidth = Math.max(1, engine.getRenderWidth());
    const renderHeight = Math.max(1, engine.getRenderHeight());

    /*
     * Size AND anchor both come from the timeline's first portrait (human 2026-08-20). Three earlier
     * attempts with constants of my own all drifted: behind the timeline, then floating in the void,
     * then sliding whenever the size changed. Matching the portrait removes every magic number —
     * no breakpoint, no multiplier — and keeps the two level and equally sized at any stage size.
     *
     * Anchored by its TOP-LEFT EDGE, never its centre: the mesh is positioned by its centre, so half
     * the footprint is added to convert one into the other. That is precisely what stops the compass
     * moving when it is resized.
     *
     * The needle holds a fixed world rotation while the camera orbits, so its projected outline
     * spins; half of its LONGEST span is the offset to use, being the radius it sweeps.
     *
     * Measured on a 901×420 stage: `getRenderWidth()` returned 901 for a 901px CSS canvas, so the
     * framebuffer matches CSS pixels even at a device ratio of 1.33 (the engine is built without
     * `adaptToDeviceRatio`). On the test phone it did NOT — the ratio conversion is what makes the
     * two agree, and it is a no-op wherever they already do.
     */
    const cssToRender = renderWidth / Math.max(1, this.canvasClientWidth());
    const cell = this.firstCell();
    const footprintPx = cell ? cell.sizePx * cssToRender : COMPASS_NATURAL_FOOTPRINT_PX;
    const halfFootprintPx = footprintPx / 2;
    const leftEdgePx = cell
      ? cell.rightPx * cssToRender
      : COMPASS_LEFT_FRACTION * COMPASS_REFERENCE_RENDER_WIDTH - halfFootprintPx;
    const topEdgePx = cell
      ? cell.topPx * cssToRender
      : COMPASS_TOP_FRACTION * COMPASS_REFERENCE_RENDER_HEIGHT - halfFootprintPx;
    const sizeScale = footprintPx / COMPASS_NATURAL_FOOTPRINT_PX;
    /*
     * Square tap area, floored at the touch target (plan 185). It used to stretch to the RIGHT to
     * swallow the ring-arrow glyph that sat there; that glyph is now a DOM legend BELOW the compass
     * (`control-legend.ts`), deliberately inert — so the area is the needle's own box again, and
     * nothing off-centre has to be compensated for.
     */
    const hitSidePx = Math.max(footprintPx, COMPASS_MIN_HIT_PX);
    /*
     * ONE px→world factor for both axes. `horizontalSpan / renderWidth` is equal to this by
     * contract (the camera derives its half-width from the aspect ratio), but relying on that
     * equality means a camera that stopped preserving aspect would drift the proxy sideways while
     * its size stayed right — a bug that reads as a mystery.
     */
    const worldPerPx = verticalSpan / renderHeight;
    this.pickProxy.scaling.set(hitSidePx * worldPerPx, hitSidePx * worldPerPx, 1);
    const leftInsetFraction = (leftEdgePx + halfFootprintPx) / renderWidth;
    const topInsetFraction = (topEdgePx + halfFootprintPx) / renderHeight;
    const x = orthoLeft + horizontalSpan * leftInsetFraction;
    const y = orthoTop - verticalSpan * topInsetFraction;

    // Size: pixel footprint = worldSize / verticalSpan * renderHeight. Setting worldSize ∝
    // verticalSpan / renderHeight makes both verticalSpan and renderHeight cancel out of that
    // footprint → a CONSTANT number of pixels, identical on any resolution, resize, or zoom.
    // Calibrated so SIZE_SCALE ≈ 1 matches the raw voxel size at the reference height.
    const scale =
      sizeScale *
      (verticalSpan / renderHeight) *
      (COMPASS_REFERENCE_RENDER_HEIGHT / BABYLON_VIEW_SIZE);
    this.root.scaling.setAll(scale);

    const right = camera.getDirection(Vector3.Right());
    const up = camera.getDirection(Vector3.Up());
    const forward = camera.getDirection(Vector3.Forward());
    this.root.position
      .copyFrom(camera.position)
      .addInPlace(forward.scale(COMPASS_CAMERA_DEPTH))
      .addInPlace(right.scale(x))
      .addInPlace(up.scale(y));

    // The proxy is concentric with the needle: same centre, same pinning maths.
    this.pickProxy.position
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
