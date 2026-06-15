// Side-effect: registers the ray builders used by `scene.pick` (tree-shaken
// Babylon omits them otherwise — picking silently returns no hit).
import "@babylonjs/core/Culling/ray";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Scene } from "@babylonjs/core/scene";
import type { TilePick } from "@pokemon-tactic/render-ports";
import type { TileMeshMetadata } from "./terrain-extruder.js";

export type { TilePick };

function tileOf(mesh: AbstractMesh | null): TilePick | null {
  const tile = (mesh?.metadata as TileMeshMetadata | undefined)?.tile;
  return tile ? { x: tile.x, y: tile.y } : null;
}

const isTileMesh = (mesh: AbstractMesh): boolean =>
  (mesh.metadata as TileMeshMetadata | undefined)?.tile !== undefined;

/**
 * Ray-cast a canvas point to the grid cell under it on the extruded terrain.
 *
 * In 3D the ray returns the front-most surface the player sees, so "highest
 * column wins" falls out for free (no diamond depth sort like the 2D
 * `screenToGridWithHeight`). A cell hidden behind a pillar is reached by rotating
 * the camera (Phase 5 feature) — no 2D-style Alt disambiguation needed.
 */
export function pickTile(scene: Scene, pointerX: number, pointerY: number): TilePick | null {
  return tileOf(scene.pick(pointerX, pointerY, isTileMesh)?.pickedMesh ?? null);
}
