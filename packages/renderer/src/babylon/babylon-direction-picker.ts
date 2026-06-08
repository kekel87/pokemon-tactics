import { loadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { Direction } from "@pokemon-tactic/core";
// Side-effect: registers the glTF 2.0 loader used by loadAssetContainerAsync.
import "@babylonjs/loaders/glTF/2.0";
import {
  BABYLON_DIRECTION_ARROW_ACTIVE_EMISSIVE,
  BABYLON_DIRECTION_ARROW_Y_OFFSET,
  BABYLON_HOVER_CURSOR_RENDERING_GROUP,
  BABYLON_SPRITE_PIXELS_PER_UNIT,
} from "./babylon-constants.js";

/** World top-face centre of a tile (what the arrow rests on). */
export interface ArrowWorldPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface DirectionArrowsPicker {
  /** Lay the four arrows on the neighbour tiles and mark `active` as selected. */
  show(neighbors: Readonly<Record<Direction, ArrowWorldPosition>>, active: Direction): void;
  /** Re-highlight which arrow is the current choice. */
  setActive(direction: Direction): void;
  /** Hide every arrow (placement confirmed/cancelled). */
  hide(): void;
  dispose(): void;
}

const ALL_DIRECTIONS = [Direction.North, Direction.South, Direction.East, Direction.West] as const;

const ARROW_GLTF_URL = "/assets/ui/arrow.gltf";

// The voxel arrow is modelled upright in the XY plane (goxel Y-up, pointing +Y);
// rotate it +90° about X to lay it flat on the ground pointing +Z (the −90° sense
// laid it flat too but pointing −Z, which sent every arrow back toward the Pokemon).
const ARROW_LAY_FLAT_X = Math.PI / 2;

// 1 voxel = 1 sprite pixel = 1/pixelsPerWorldUnit world units (goxel exports 1 voxel
// per gltf unit), so the arrow shares the exact pixel density of the Pokemon sprites.
const ARROW_VOXEL_WORLD_SIZE = 1 / BABYLON_SPRITE_PIXELS_PER_UNIT;

// Yaw bringing the flattened arrow onto each world direction. gridX → world Z,
// gridY → world X: North = -X, South = +X, East = +Z, West = -Z.
const ROTATION_Y: Readonly<Record<Direction, number>> = {
  [Direction.East]: 0,
  [Direction.South]: Math.PI / 2,
  [Direction.West]: Math.PI,
  [Direction.North]: -Math.PI / 2,
};

// The flattened arrow points back toward the Pokemon; +π turns each one outward.
const ARROW_YAW_OFFSET = Math.PI;

/**
 * Placement direction picker rendered IN the Babylon scene (plan 120, décision
 * #487): a voxel arrow (`arrow.gltf`) laid flat on each of the four neighbour
 * tiles, rotated to point outward from the Pokemon being placed. Being real scene
 * meshes, they follow the camera rotation (←/→), zoom and window resize for free.
 * Interaction (hover preview, click confirm, Escape cancel) is routed by the
 * combat scene via tile picking. The glTF loads asynchronously; a `show` issued
 * before the load completes is replayed once the arrows are built.
 */
export function createDirectionArrows(scene: Scene): DirectionArrowsPicker {
  const root = new TransformNode("direction_arrows", scene);
  // Per-direction positionable node (carries tile position + outward yaw).
  const arrowByDirection = new Map<Direction, TransformNode>();
  let pending: {
    neighbors: Readonly<Record<Direction, ArrowWorldPosition>>;
    active: Direction;
  } | null = null;

  const activeEmissive = new Color3(
    BABYLON_DIRECTION_ARROW_ACTIVE_EMISSIVE.r,
    BABYLON_DIRECTION_ARROW_ACTIVE_EMISSIVE.g,
    BABYLON_DIRECTION_ARROW_ACTIVE_EMISSIVE.b,
  );
  const noEmissive = new Color3(0, 0, 0);

  /** Tint the selected arrow with an emissive glow; clear the others (voxel material has no alpha to dim). */
  function setActive(direction: Direction): void {
    for (const [arrowDirection, node] of arrowByDirection) {
      const color = arrowDirection === direction ? activeEmissive : noEmissive;
      for (const mesh of node.getChildMeshes()) {
        const material = mesh.material;
        if (material instanceof PBRMaterial || material instanceof StandardMaterial) {
          material.emissiveColor = color;
        }
      }
    }
  }

  function applyShow(
    neighbors: Readonly<Record<Direction, ArrowWorldPosition>>,
    active: Direction,
  ): void {
    for (const direction of ALL_DIRECTIONS) {
      const node = arrowByDirection.get(direction);
      const position = neighbors[direction];
      if (!node) {
        continue;
      }
      node.position.set(position.x, position.y + BABYLON_DIRECTION_ARROW_Y_OFFSET, position.z);
      node.setEnabled(true);
    }
    setActive(active);
  }

  function buildArrows(template: Mesh): void {
    // Keep the (disabled) template under root so it's disposed with the picker.
    template.parent = root;
    for (const direction of ALL_DIRECTIONS) {
      const node = new TransformNode(`direction_arrow_${direction}`, scene);
      node.parent = root;
      node.rotation.y = ROTATION_Y[direction] + ARROW_YAW_OFFSET;
      node.setEnabled(false);
      const clone = template.clone(`direction_arrow_mesh_${direction}`);
      clone.parent = node;
      // Direction is read from the pointer (combat-scene), not by picking the arrow.
      clone.isPickable = false;
      clone.setEnabled(true);
      // Always-on-top UI layer (like the hover cursor): keeps the arrows visible
      // and OUT of the group-0 depth the X-ray silhouette tests against, so a
      // Pokémon never shows its silhouette through an arrow.
      clone.renderingGroupId = BABYLON_HOVER_CURSOR_RENDERING_GROUP;
      // Own material per arrow so the active glow doesn't bleed onto the others.
      const material = clone.material?.clone(`direction_arrow_mat_${direction}`);
      if (material) {
        clone.material = material;
      }
      arrowByDirection.set(direction, node);
    }
  }

  /**
   * Normalises the imported arrow into a unit template at the origin: bakes the
   * glTF coordinate conversion, lays it flat, scales it to the target tile size
   * and recentres it so a clone dropped on a tile sits centred and flush.
   */
  function normalizeTemplate(mesh: Mesh): Mesh {
    mesh.setParent(null);
    mesh.bakeCurrentTransformIntoVertices();
    mesh.rotation.x = ARROW_LAY_FLAT_X;
    // 1 voxel → 1 sprite pixel (goxel = 1 voxel per gltf unit), not a fit-to-size scale.
    mesh.scaling.setAll(ARROW_VOXEL_WORLD_SIZE);
    mesh.bakeCurrentTransformIntoVertices();
    mesh.refreshBoundingInfo();
    const center = mesh.getBoundingInfo().boundingBox.center;
    mesh.position.set(-center.x, -center.y, -center.z);
    mesh.bakeCurrentTransformIntoVertices();
    mesh.position.setAll(0);
    mesh.setEnabled(false);
    return mesh;
  }

  void loadAssetContainerAsync(ARROW_GLTF_URL, scene)
    .then((container) => {
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
      const template = normalizeTemplate(merged);
      buildArrows(template);
      // Free the loader's residual nodes (the `__root__` space-conversion node and
      // any leftovers); `normalizeTemplate` already detached the template, so it is
      // never one of these and survives.
      for (const node of container.rootNodes) {
        if (node !== template) {
          node.dispose();
        }
      }
      if (pending) {
        applyShow(pending.neighbors, pending.active);
        pending = null;
      }
    })
    .catch((error) => {
      // biome-ignore lint/suspicious/noConsole: surfacing a fatal picker-asset load failure
      console.error("Failed to load direction arrow", ARROW_GLTF_URL, error);
    });

  return {
    show: (neighbors, active) => {
      if (arrowByDirection.size === 0) {
        pending = { neighbors, active };
        return;
      }
      applyShow(neighbors, active);
    },
    setActive,
    hide: () => {
      pending = null;
      for (const node of arrowByDirection.values()) {
        node.setEnabled(false);
      }
    },
    dispose: () => {
      root.dispose(false, true);
    },
  };
}
