import type { Camera } from "@babylonjs/core/Cameras/camera";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

/**
 * World→screen projection for category-A (world-anchored) overlay elements
 * (Phase 5 Jalon 2). HP bars, cursor, floating damage, status badges live in
 * the DOM `.ui-world` layer and are re-positioned every frame from their 3D
 * anchor.
 *
 * Performance rule (best-practices 2026): batch all reads, then all writes, to
 * avoid layout thrash. `projectAnchors` computes every screen position first
 * (pure math), then writes every `transform` in a second pass — never alternating.
 *
 * Projected coordinates are in **CSS pixels** of the canvas client box, matching
 * the overlay rect. Positions are `Math.round`-snapped to keep pixel-art crisp.
 */

export interface WorldAnchor {
  /** DOM node in the `.ui-world` layer to position. */
  readonly element: HTMLElement;
  /** Current 3D world position to project (foot or head of a sprite, a tile, …). */
  readonly worldPosition: Vector3;
}

// Scratch objects reused across frames so projection allocates nothing.
const worldIdentityMatrix = new Matrix();
const projected = new Vector3();

interface PendingWrite {
  readonly element: HTMLElement;
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
}

/**
 * Project every anchor and apply it to its DOM element. `cssWidth`/`cssHeight`
 * are the canvas client size in CSS pixels (NOT the backing-store render size,
 * which differs under `hardwareScalingLevel`).
 */
export function projectAnchors(
  scene: Scene,
  camera: Camera,
  anchors: readonly WorldAnchor[],
  cssWidth: number,
  cssHeight: number,
): void {
  if (anchors.length === 0) {
    return;
  }

  // READ pass: pure math, no DOM access.
  const transform = scene.getTransformMatrix();
  const viewport = camera.viewport.toGlobal(cssWidth, cssHeight);
  Matrix.IdentityToRef(worldIdentityMatrix);
  const writes: PendingWrite[] = [];
  for (const anchor of anchors) {
    Vector3.ProjectToRef(anchor.worldPosition, worldIdentityMatrix, transform, viewport, projected);
    writes.push({
      element: anchor.element,
      x: Math.round(projected.x),
      y: Math.round(projected.y),
      // z within [0,1] means in front of the near plane and inside the frustum depth.
      visible: projected.z >= 0 && projected.z <= 1,
    });
  }

  // WRITE pass: grouped DOM mutations, no interleaved reads → no thrash.
  for (const write of writes) {
    if (write.visible) {
      write.element.style.transform = `translate3d(${write.x}px, ${write.y}px, 0)`;
      write.element.style.visibility = "visible";
    } else {
      write.element.style.visibility = "hidden";
    }
  }
}
