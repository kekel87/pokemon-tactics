import type { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import { loadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
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
 * Rotation hint beside the compass (chantier glyphes, suite du Lot 1). Nothing on screen said the
 * compass was tappable at all; a ring-arrow next to it does, and it stays inside the compass' own
 * tap area rather than becoming a second control.
 *
 * Drawn here rather than in the DOM chrome on purpose: the compass is placed by pixel arithmetic
 * every frame from the timeline's first portrait, so a DOM twin would need that measurement
 * mirrored and re-synced. One mesh beside the other keeps a single source of position.
 *
 * Sheet layout and tile indices: `docs/references/kenney-input-prompts-tileset.md`.
 */
const INPUT_PROMPT_SHEET_URL = "assets/ui/input-prompts/tilemap-1bit.png";
const INPUT_PROMPT_TILE_PX = 16;
const INPUT_PROMPT_SHEET_COLUMNS = 34;
const INPUT_PROMPT_SHEET_ROWS = 24;
/*
 * Ring-arrow matching the direction a compass tap turns the view. Column 30 (the arrow reading as
 * clockwise) was tried first and read BACKWARDS to the human on the live scene — the needle's
 * apparent spin is not what the eye reads as "the view turning". Trust the play-test, not the
 * geometry: the tile is the human's own pick (2026-08-20).
 */
const COMPASS_ROTATE_GLYPH_COLUMN = 27;
const COMPASS_ROTATE_GLYPH_ROW = 19;
/** Glyph height as a fraction of the compass footprint, before snapping to a step. */
const COMPASS_ROTATE_GLYPH_FRACTION = 0.5;
/**
 * Size step, in px: a HALF tile, not a whole one.
 *
 * Whole-tile steps (16px) only offer 32 or 48px beside the 79px compass of a 4K stage — the human
 * read the first as too small and the second as too big, with nothing in between: every adjustment
 * jumped by ×2. A half step allows ×2.5 (40px). Nearest-neighbour sampling then alternates 2px and
 * 3px columns instead of drawing every source pixel identically — visible under inspection, not at
 * play size on a plain ring. A deliberate, documented exception to the integer-upscale rule that
 * governs the CSS glyphs (`docs/references/kenney-input-prompts-tileset.md`).
 */
const COMPASS_ROTATE_GLYPH_STEP_PX = 8;
/** Gap between the compass' right edge and the glyph, in framebuffer px at the reference height. */
const COMPASS_ROTATE_GLYPH_GAP_PX = 6;
/** Discreet on purpose: an affordance hint, not game state — the needle beside it is already loud. */
const COMPASS_ROTATE_GLYPH_ALPHA = 0.72;
const COMPASS_ROTATE_GLYPH_NAME = "compass_rotate_hint";

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
  /** Ring-arrow drawn to the compass' right, inside the same tap area. Never pickable itself. */
  private readonly rotateHint: Mesh;
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
     * A screen-aligned PLANE, sized per frame, rather than a cube parented to the root: the area now
     * has to cover the compass AND the rotation glyph to its right (human 2026-08-20), which is an
     * off-centre, non-square region. A cube grown to reach the glyph would have swallowed as much
     * board BELOW the compass as it gained on the right — tapping a tile there would have rotated
     * the camera. `BILLBOARDMODE_ALL` keeps the rectangle facing the orbiting camera, so its screen
     * footprint stays exactly what the maths says.
     *
     * Built up-front, not with the glb: the compass answers taps as soon as it is on screen, and a
     * proxy that only appeared after an async load would silently swallow early taps.
     */
    this.pickProxy = CreatePlane(COMPASS_PICK_PROXY_NAME, { size: 1 }, scene);
    this.pickProxy.billboardMode = Mesh.BILLBOARDMODE_ALL;
    // Invisible but pickable: `scene.pick` skips invisible meshes only under its DEFAULT predicate,
    // and `isHit` passes its own — the same trick `pickTile` uses for tile meshes.
    this.pickProxy.isVisible = false;

    this.rotateHint = this.createRotateHint(scene);

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
    // Neither of these is a child of the root — both must stay screen-aligned while it spins — so
    // the recursive dispose above never reaches them.
    this.pickProxy.dispose(false, true);
    this.rotateHint.dispose(false, true);
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
    // Hint height snapped to `COMPASS_ROTATE_GLYPH_STEP_PX` — see that constant for why the step is
    // half a tile rather than a whole one.
    const glyphPx = Math.max(
      INPUT_PROMPT_TILE_PX,
      Math.round((footprintPx * COMPASS_ROTATE_GLYPH_FRACTION) / COMPASS_ROTATE_GLYPH_STEP_PX) *
        COMPASS_ROTATE_GLYPH_STEP_PX,
    );
    const glyphGapPx = COMPASS_ROTATE_GLYPH_GAP_PX * cssToRender;
    /*
     * The tap area spans compass + gap + glyph (human 2026-08-20: the glyph counts as part of the
     * compass' area, not as a second control), and stretches only to the RIGHT — hence a rectangle
     * offset by half of what it gained, instead of a symmetric growth that would have made the
     * board below the compass rotate the camera.
     */
    const hitWidthPx = Math.max(footprintPx + glyphGapPx + glyphPx, COMPASS_MIN_HIT_PX);
    const hitHeightPx = Math.max(footprintPx, COMPASS_MIN_HIT_PX);
    /*
     * ONE px→world factor for both axes. `horizontalSpan / renderWidth` is equal to this by
     * contract (the camera derives its half-width from the aspect ratio), but relying on that
     * equality means a camera that stopped preserving aspect would drift the glyph sideways while
     * its size stayed right — a bug that reads as a mystery.
     */
    const worldPerPx = verticalSpan / renderHeight;
    this.pickProxy.scaling.set(hitWidthPx * worldPerPx, hitHeightPx * worldPerPx, 1);
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

    // Same pinning maths for the hint, offset to the compass' right by half of each footprint plus
    // the gap. Both offsets convert px → ortho units through the spans, exactly as `x`/`y` did.
    const hintOffsetX = (footprintPx / 2 + glyphGapPx + glyphPx / 2) * worldPerPx;
    if (!this.rotateHint.isVisible) {
      this.rotateHint.isVisible = true;
    }
    this.rotateHint.scaling.setAll(glyphPx * worldPerPx);
    this.rotateHint.position
      .copyFrom(camera.position)
      .addInPlace(forward.scale(COMPASS_CAMERA_DEPTH))
      .addInPlace(right.scale(x + hintOffsetX))
      .addInPlace(up.scale(y));

    // The proxy spans compass→glyph, so its centre sits half the added width to the right.
    const proxyOffsetX = ((hitWidthPx - footprintPx) / 2) * worldPerPx;
    this.pickProxy.position
      .copyFrom(camera.position)
      .addInPlace(forward.scale(COMPASS_CAMERA_DEPTH))
      .addInPlace(right.scale(x + proxyOffsetX))
      .addInPlace(up.scale(y));
  }

  /**
   * Ring-arrow plane masked down to one tile of the shared 1-bit sheet.
   *
   * `BILLBOARDMODE_ALL` is what keeps it upright: the compass needle deliberately spins with the
   * orbiting camera, and a glyph that spun with it would read as tilted text.
   *
   * UVs are flipped by hand because Babylon's `invertY` is on by default (see
   * `docs/references/babylon-gotchas.md`), and sampling is NEAREST so a 16px tile survives its
   * upscale.
   */
  private createRotateHint(scene: Scene): Mesh {
    const plane = CreatePlane(COMPASS_ROTATE_GLYPH_NAME, { size: 1 }, scene);
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plane.renderingGroupId = BABYLON_HUD_RENDERING_GROUP;
    plane.isPickable = false;
    // Hidden until the first pin: `pinToCorner` only runs once the glb has loaded, and until then
    // the plane would sit at the world origin, in the middle of the board. Flipped once by
    // `pinToCorner`, not per frame — a per-frame write would also pin it visible forever.
    plane.isVisible = false;

    const texture = new Texture(
      INPUT_PROMPT_SHEET_URL,
      scene,
      true,
      undefined,
      Texture.NEAREST_SAMPLINGMODE,
    );
    texture.hasAlpha = true;
    texture.uScale = 1 / INPUT_PROMPT_SHEET_COLUMNS;
    texture.vScale = 1 / INPUT_PROMPT_SHEET_ROWS;
    texture.uOffset = COMPASS_ROTATE_GLYPH_COLUMN / INPUT_PROMPT_SHEET_COLUMNS;
    texture.vOffset = 1 - (COMPASS_ROTATE_GLYPH_ROW + 1) / INPUT_PROMPT_SHEET_ROWS;

    const material = new StandardMaterial(COMPASS_ROTATE_GLYPH_NAME, scene);
    material.disableLighting = true;
    material.emissiveColor.set(1, 1, 1);
    material.diffuseTexture = texture;
    material.opacityTexture = texture;
    material.useAlphaFromDiffuseTexture = true;
    // Alpha-BLEND, not the alpha-test the sprites use: this one is deliberately translucent, and it
    // lives on the HUD group where depth is cleared anyway, so there is nothing to occlude.
    material.alpha = COMPASS_ROTATE_GLYPH_ALPHA;
    material.backFaceCulling = false;
    plane.material = material;
    return plane;
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
