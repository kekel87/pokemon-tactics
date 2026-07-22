import { Camera } from "@babylonjs/core/Cameras/camera";
import { TargetCamera } from "@babylonjs/core/Cameras/targetCamera";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import {
  BABYLON_AZIMUTH_LERP_EPSILON,
  BABYLON_AZIMUTH_STEP,
  BABYLON_CAMERA_AZIMUTH,
  BABYLON_CAMERA_DISTANCE,
  BABYLON_CAMERA_PAN_EPSILON,
  BABYLON_CAMERA_PAN_LERP,
  BABYLON_DIMETRIC_ELEVATION,
  BABYLON_ROTATION_LERP,
  BABYLON_VIEW_SIZE,
  BABYLON_ZOOM_DEFAULT_INDEX,
  BABYLON_ZOOM_LERP,
  BABYLON_ZOOM_LERP_EPSILON,
  BABYLON_ZOOM_LEVELS,
} from "./babylon-constants.js";

/** Fired on every azimuth change so screen-pinned overlays (compass, arrows) re-align. */
export type CameraRotatedHandler = (azimuth: number) => void;

/**
 * Dimetric orthographic camera for the iso view: snaps between the 4 iso azimuths
 * (eased 90° turns), mouse-wheel zoom, pointer pan, and a smooth recentre toward a
 * goal tile. Owns its Babylon `TargetCamera`; consumers that need raw projection or
 * picking read it via `camera`.
 */
export class IsometricCamera {
  /** Underlying Babylon camera — read-only handle for projection/picking consumers. */
  readonly camera: TargetCamera;

  private readonly engine: Engine;
  private readonly target = new Vector3(0, 0, 0);
  // Goal the centre eases toward (recentering on the active Pokémon); the first
  // recentre snaps, later turns slide smoothly.
  private readonly goal = new Vector3(0, 0, 0);
  private centered = false;
  // Discrete zoom: an index into BABYLON_ZOOM_LEVELS the wheel steps through.
  // `zoom` (current) eases toward `zoomTarget` (the selected level) each tick.
  private zoomIndex = BABYLON_ZOOM_DEFAULT_INDEX;
  private zoom: number = BABYLON_ZOOM_LEVELS[BABYLON_ZOOM_DEFAULT_INDEX];
  private zoomTarget: number = BABYLON_ZOOM_LEVELS[BABYLON_ZOOM_DEFAULT_INDEX];
  // Current (eased) azimuth and the snapped 90° goal it eases toward.
  private azimuthCurrent = BABYLON_CAMERA_AZIMUTH;
  private azimuthTarget = BABYLON_CAMERA_AZIMUTH;
  private rotatedHandler: CameraRotatedHandler = () => undefined;

  constructor(scene: Scene, engine: Engine) {
    this.engine = engine;
    const camera = new TargetCamera("combat_ortho", Vector3.Zero(), scene);
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    camera.minZ = 0.1;
    camera.maxZ = 100;
    this.camera = camera;
    this.update();
  }

  /** Current eased azimuth (drives sprite billboarding). */
  get azimuth(): number {
    return this.azimuthCurrent;
  }

  /** Recompute the camera position + orthographic bounds from the current state. */
  update(): void {
    const azimuth = this.azimuthCurrent;
    this.camera.position.set(
      this.target.x +
        Math.cos(BABYLON_DIMETRIC_ELEVATION) * Math.cos(azimuth) * BABYLON_CAMERA_DISTANCE,
      this.target.y + Math.sin(BABYLON_DIMETRIC_ELEVATION) * BABYLON_CAMERA_DISTANCE,
      this.target.z +
        Math.cos(BABYLON_DIMETRIC_ELEVATION) * Math.sin(azimuth) * BABYLON_CAMERA_DISTANCE,
    );
    this.camera.setTarget(this.target);
    const aspect = this.engine.getRenderWidth() / this.engine.getRenderHeight();
    const halfWidth = (BABYLON_VIEW_SIZE * aspect) / (2 * this.zoom);
    const halfHeight = BABYLON_VIEW_SIZE / (2 * this.zoom);
    this.camera.orthoLeft = -halfWidth;
    this.camera.orthoRight = halfWidth;
    this.camera.orthoTop = halfHeight;
    this.camera.orthoBottom = -halfHeight;
    this.rotatedHandler(azimuth);
  }

  /** Register the azimuth-change callback; fires immediately with the current azimuth. */
  onRotated(handler: CameraRotatedHandler): void {
    this.rotatedHandler = handler;
    handler(this.azimuthCurrent);
  }

  /** Snap the azimuth goal by one 90° iso step (`-1` left, `1` right); eased in `tick`. */
  rotateByStep(direction: -1 | 1): void {
    this.azimuthTarget += direction * BABYLON_AZIMUTH_STEP;
  }

  /** Mouse-wheel zoom: step one discrete level (negative `deltaY` zooms in), eased in `tick`. */
  zoomByWheel(deltaY: number): void {
    const nextIndex = this.zoomIndex + (deltaY < 0 ? 1 : -1);
    this.zoomIndex = Math.min(BABYLON_ZOOM_LEVELS.length - 1, Math.max(0, nextIndex));
    // Index is clamped in-range; `?? this.zoomTarget` only satisfies noUncheckedIndexedAccess.
    this.zoomTarget = BABYLON_ZOOM_LEVELS[this.zoomIndex] ?? this.zoomTarget;
  }

  /** Pan the centre in the view plane by a pointer drag delta (pixels). */
  panByPixels(deltaX: number, deltaY: number, canvasClientHeight: number): void {
    const worldPerPixel = BABYLON_VIEW_SIZE / this.zoom / canvasClientHeight;
    const right = this.camera.getDirection(Vector3.Right());
    const up = this.camera.getDirection(Vector3.Up());
    this.target
      .addInPlace(right.scale(-deltaX * worldPerPixel))
      .addInPlace(up.scale(deltaY * worldPerPixel));
    // A manual pan wins over any in-flight auto-pan: align the goal onto the new
    // target so the `tick` lerp has nothing left to pull back toward.
    this.goal.copyFrom(this.target);
    this.update();
  }

  /** Hard-frame the centre on a world point (initial map framing); leaves the goal untouched. */
  frameOn(x: number, y: number, z: number): void {
    this.target.set(x, y, z);
    this.update();
  }

  /** Ease the centre toward a world point; the first recentre snaps (no slide from origin). */
  panTo(x: number, y: number, z: number): void {
    this.goal.set(x, y, z);
    if (!this.centered) {
      this.target.copyFrom(this.goal);
      this.centered = true;
      this.update();
    }
  }

  /** Per-frame easing of azimuth + centre toward their goals. Call once per render loop. */
  tick(deltaMs: number): void {
    // Ease the azimuth toward the snapped 90° target (smooth iso turn).
    const azimuthDelta = this.azimuthTarget - this.azimuthCurrent;
    if (Math.abs(azimuthDelta) > BABYLON_AZIMUTH_LERP_EPSILON) {
      this.azimuthCurrent += azimuthDelta * Math.min(1, BABYLON_ROTATION_LERP * (deltaMs / 1000));
      this.update();
    } else if (this.azimuthCurrent !== this.azimuthTarget) {
      this.azimuthCurrent = this.azimuthTarget;
      this.update();
    }

    // Ease the current zoom toward the selected discrete level (smooth wheel steps).
    const zoomDelta = this.zoomTarget - this.zoom;
    if (Math.abs(zoomDelta) > BABYLON_ZOOM_LERP_EPSILON) {
      this.zoom += zoomDelta * Math.min(1, BABYLON_ZOOM_LERP * (deltaMs / 1000));
      this.update();
    } else if (this.zoom !== this.zoomTarget) {
      this.zoom = this.zoomTarget;
      this.update();
    }

    // Ease the camera centre toward its goal (smooth recentre on the active Pokémon).
    const panDistance = Vector3.Distance(this.target, this.goal);
    if (panDistance > BABYLON_CAMERA_PAN_EPSILON) {
      Vector3.LerpToRef(
        this.target,
        this.goal,
        Math.min(1, BABYLON_CAMERA_PAN_LERP * (deltaMs / 1000)),
        this.target,
      );
      this.update();
    } else if (!this.target.equals(this.goal)) {
      this.target.copyFrom(this.goal);
      this.update();
    }
  }
}
