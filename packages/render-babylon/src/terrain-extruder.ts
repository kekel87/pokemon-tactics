import { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3, Vector4 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { SubMesh } from "@babylonjs/core/Meshes/subMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import {
  type LoadedTiledMap,
  gridToWorldXZ as sharedGridToWorldXZ,
  type VisualTerrainGroup,
} from "@pokemon-tactic/view-core";
import {
  BABYLON_SIDE_DARKEN,
  BABYLON_TILE_CENTER_MARKER_COLOR,
  BABYLON_TILE_GRID_COLOR,
  BABYLON_TILE_GRID_Z_OFFSET,
} from "./babylon-constants.js";
import {
  DEFAULT_GRASS_TINT,
  makeBlockMaterial,
  makeGrassSideMaterial,
  type Rgb,
} from "./voxel-textures.js";

/** Grid coordinate stamped on each extruded tile mesh, decoded back on pick. */
export interface TileMeshMetadata {
  readonly tile: { readonly x: number; readonly y: number };
}

export interface ExtrudedTerrain {
  readonly root: TransformNode;
  readonly worldWidth: number;
  readonly worldDepth: number;
  /** Disposes the terrain root and all its meshes/materials/textures. */
  dispose(): void;
}

// Babylon is left-handed; bind the shared view geometry to that handedness.

/**
 * Voxel column height in world units (plan 129, temps 1.2). 1 height unit = 1 cube
 * edge = 1 world unit (matching the 1-unit tile footprint) → true Minecraft cube
 * proportions instead of the old squashed 0.866 iso scale. The raw tile height IS the
 * cube count (NO rounding), so half-steps (0.5 = slab) and stacked elevation layers stay
 * distinct — a 0.5-unit floor keeps the same relative drop it had in the 2D renderer
 * (e.g. volcano lava dips sit half a block below the h=1 ground). `max(0.5, …)` only
 * guards empty cells against a zero-height (invisible) column. Every world-Y consumer
 * (sprites, cursor, highlights, field terrains, decorations) routes through here, so the
 * whole scene stays aligned.
 */
export function tileBodyHeight(tileHeight: number): number {
  return Math.max(0.5, tileHeight);
}

/** Grid (col, row) → world XZ, matching the 2D iso orientation (left-handed binding). */
export function gridToWorldXZ(
  gridX: number,
  gridY: number,
  mapWidth: number,
  mapHeight: number,
): { x: number; z: number } {
  return sharedGridToWorldXZ(gridX, gridY, mapWidth, mapHeight, "left-handed");
}

/** World-space centre of the TOP face of a tile, in the centred terrain frame. */
export function tileTopCenter(
  gridX: number,
  gridY: number,
  tileHeight: number,
  mapWidth: number,
  mapHeight: number,
): { x: number; y: number; z: number } {
  const { x, z } = gridToWorldXZ(gridX, gridY, mapWidth, mapHeight);
  return { x, y: tileBodyHeight(tileHeight), z };
}

/**
 * Per-terrain flat materials applied to the 3D tiles — plan 129 voxel re-skin: the
 * top/side faces use Minecraft block textures (real PNG if the local pack is present,
 * else a procedural fallback; see `voxel-textures.ts`). Materials are cached per
 * terrain group so a map allocates at most one top + one side per terrain.
 */
function createMaterialFactory(scene: Scene, grassTint?: Rgb) {
  const topByGroup = new Map<VisualTerrainGroup, StandardMaterial>();
  const sideByGroup = new Map<VisualTerrainGroup, StandardMaterial>();

  function topMaterial(group: VisualTerrainGroup): StandardMaterial {
    const cached = topByGroup.get(group);
    if (cached) {
      return cached;
    }
    // The per-map biome tint is grass-only; other tinted blocks (swamp water) keep
    // their own fixed `spec.tint`.
    const tintOverride = group === "herbe" || group === "tall_grass" ? grassTint : undefined;
    const material = makeBlockMaterial(scene, group, { face: "top", tintOverride });
    topByGroup.set(group, material);
    return material;
  }

  function sideMaterial(group: VisualTerrainGroup): StandardMaterial {
    const cached = sideByGroup.get(group);
    if (cached) {
      return cached;
    }
    // Grass sides are composited (dirt + biome-tinted fringe) like the MC engine, so the
    // side fringe follows the same per-map tint as the top instead of a baked-in green.
    const material =
      group === "herbe" || group === "tall_grass"
        ? makeGrassSideMaterial(scene, grassTint ?? DEFAULT_GRASS_TINT)
        : makeBlockMaterial(scene, group, { face: "side", darken: BABYLON_SIDE_DARKEN });
    sideByGroup.set(group, material);
    return material;
  }

  function dispose(): void {
    for (const material of topByGroup.values()) {
      material.dispose(false, true);
    }
    for (const material of sideByGroup.values()) {
      material.dispose(false, true);
    }
  }

  return { topMaterial, sideMaterial, dispose };
}

/**
 * Extrudes a `MapDefinition` into a grid of boxes. Each tile is a unit box scaled
 * on Y by its height; the top face is textured with the flat top-down PMD terrain
 * texture and the four sides with the matching wall texture.
 */
export function extrudeTerrain(
  scene: Scene,
  loaded: LoadedTiledMap,
  grassTint?: Rgb,
): ExtrudedTerrain {
  const { map, visualTiles } = loaded;
  const { width, height } = map;
  const root = new TransformNode("terrain", scene);
  const factory = createMaterialFactory(scene, grassTint);

  // One block box for a tile: footprint 1×1, `boxHeight` tall, bottom at `baseY`.
  // Sides tile the texture per world unit (so stacked cubes read as blocks); the top
  // face gets the top texture only when this box IS the surface (`isSurface`) — a base
  // block under a half-step slab keeps a side texture on top (it is hidden anyway).
  function createTileBox(
    x: number,
    y: number,
    group: VisualTerrainGroup,
    worldX: number,
    worldZ: number,
    baseY: number,
    boxHeight: number,
    isSurface: boolean,
    label: string,
  ): void {
    const sideUv = new Vector4(0, 0, 1, boxHeight);
    const topUv = new Vector4(0, 0, 1, 1);
    const faceUV = [sideUv, sideUv, sideUv, sideUv, topUv, topUv];

    const box = MeshBuilder.CreateBox(label, { size: 1, faceUV, wrap: true }, scene);
    box.scaling.set(1, boxHeight, 1);
    box.position.set(worldX, baseY + boxHeight / 2, worldZ);
    box.parent = root;

    const side = factory.sideMaterial(group);
    const topMaterial = isSurface ? factory.topMaterial(group) : side;
    const multi = new MultiMaterial(`${label}_mat`, scene);
    multi.subMaterials = [side, side, side, side, topMaterial, side];
    box.material = multi;

    // Split the box into one SubMesh per face (6 verts each) so the 6-entry
    // MultiMaterial maps correctly — a default box has a single submesh that
    // would only ever use the first sub-material.
    const verticesCount = box.getTotalVertices();
    box.subMeshes = [];
    for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
      box.subMeshes.push(new SubMesh(faceIndex, 0, verticesCount, faceIndex * 6, 6, box));
    }

    // Pickable for ray-cast tile selection; the grid coord rides on the mesh so a
    // pick decodes straight back to (x, y). Frozen world matrix is valid for picking.
    box.isPickable = true;
    box.metadata = { tile: { x, y } } satisfies TileMeshMetadata;
    box.freezeWorldMatrix();
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = visualTiles[y]?.[x];
      if (!tile) {
        continue;
      }

      // Split a fractional column into a whole-cube base + a real half-height slab on
      // top (plan 129, temps 1.2) so a 0.5 step renders as true Minecraft slab geometry
      // (surface at half height) instead of a stretched texture. A pure 0.5 cell has no
      // full base — it is just the slab sitting on the ground.
      const totalHeight = tileBodyHeight(tile.height);
      const fullHeight = Math.floor(totalHeight);
      const slabHeight = totalHeight - fullHeight;
      const world = gridToWorldXZ(x, y, width, height);

      if (fullHeight > 0) {
        createTileBox(
          x,
          y,
          tile.group,
          world.x,
          world.z,
          0,
          fullHeight,
          slabHeight === 0,
          `tile_${x}_${y}`,
        );
      }
      if (slabHeight > 0) {
        createTileBox(
          x,
          y,
          tile.group,
          world.x,
          world.z,
          fullHeight,
          slabHeight,
          true,
          `tile_${x}_${y}_slab`,
        );
      }
    }
  }

  return {
    root,
    worldWidth: width,
    worldDepth: height,
    dispose: () => {
      root.dispose(false, true);
      factory.dispose();
    },
  };
}

/**
 * Debug helper: a small marker at the centre of every tile top, to verify sprite
 * placement / picking alignment. Returns a root node (toggle via `setEnabled`).
 */
export function createTileCenterMarkers(scene: Scene, loaded: LoadedTiledMap): TransformNode {
  const { map, visualTiles } = loaded;
  const { width, height } = map;
  const root = new TransformNode("tile_center_markers", scene);

  const material = new StandardMaterial("tile_center_marker_mat", scene);
  material.emissiveColor = new Color3(
    BABYLON_TILE_CENTER_MARKER_COLOR.r,
    BABYLON_TILE_CENTER_MARKER_COLOR.g,
    BABYLON_TILE_CENTER_MARKER_COLOR.b,
  );
  material.disableLighting = true;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = visualTiles[y]?.[x];
      if (!tile) {
        continue;
      }
      const center = tileTopCenter(x, y, tile.height, width, height);
      const marker = MeshBuilder.CreateBox(`center_${x}_${y}`, { size: 0.12 }, scene);
      marker.scaling.set(1, 0.05, 1);
      marker.position.set(center.x, center.y + 0.03, center.z);
      marker.material = material;
      marker.isPickable = false;
      marker.parent = root;
    }
  }

  return root;
}

/**
 * Debug helper: a wireframe outline of every tile's top face, to read the grid
 * and judge how sprites sit on the tiles. Returns a LinesMesh (toggle via
 * `setEnabled`).
 */
export function createTileGrid(scene: Scene, loaded: LoadedTiledMap): TransformNode {
  const { map, visualTiles } = loaded;
  const { width, height } = map;
  const lines: Vector3[][] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = visualTiles[y]?.[x];
      if (!tile) {
        continue;
      }
      const center = tileTopCenter(x, y, tile.height, width, height);
      const top = center.y + BABYLON_TILE_GRID_Z_OFFSET; // lift off the top face to avoid z-fighting
      const minX = center.x - 0.5;
      const maxX = center.x + 0.5;
      const minZ = center.z - 0.5;
      const maxZ = center.z + 0.5;
      lines.push([
        new Vector3(minX, top, minZ),
        new Vector3(maxX, top, minZ),
        new Vector3(maxX, top, maxZ),
        new Vector3(minX, top, maxZ),
        new Vector3(minX, top, minZ),
      ]);
    }
  }

  const grid = MeshBuilder.CreateLineSystem("tile_grid", { lines }, scene);
  grid.color = new Color3(
    BABYLON_TILE_GRID_COLOR.r,
    BABYLON_TILE_GRID_COLOR.g,
    BABYLON_TILE_GRID_COLOR.b,
  );
  grid.isPickable = false;
  return grid;
}
