import { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3, Vector4 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { SubMesh } from "@babylonjs/core/Meshes/subMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import {
  type LoadedTiledMap,
  gridToWorldXZ as sharedGridToWorldXZ,
  tileBodyHeight as sharedTileBodyHeight,
  tileTopCenter as sharedTileTopCenter,
  type VisualTerrainGroup,
} from "@pokemon-tactic/view-core";
import {
  BABYLON_SIDE_DARKEN,
  BABYLON_TILE_CENTER_MARKER_COLOR,
  BABYLON_TILE_GRID_COLOR,
  BABYLON_TILE_GRID_Z_OFFSET,
  BABYLON_TILE_HEIGHT_SCALE,
  BABYLON_TILE_MIN_HEIGHT,
} from "./babylon-constants.js";

/** Base URL of the flat top-down PMD terrain textures (one per visual group). */
const TERRAIN_TEXTURE_BASE = "assets/tilesets/terrain-3d";

/** Visual groups that ship a dedicated side/wall texture; others reuse a darkened top. */
const DISTINCT_SIDE_GROUPS: ReadonlySet<VisualTerrainGroup> = new Set<VisualTerrainGroup>([
  "herbe",
  "tall_grass",
  "sable",
  "snow",
  "water",
]);

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

// Babylon is left-handed; bind the shared view geometry to that handedness + the
// Babylon tile-height constants so every call site stays a plain (gridX, gridY) call.

/** World-space height of a tile body (Babylon binding of the shared view geometry). */
export function tileBodyHeight(tileHeight: number): number {
  return sharedTileBodyHeight(tileHeight, BABYLON_TILE_MIN_HEIGHT, BABYLON_TILE_HEIGHT_SCALE);
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
  return sharedTileTopCenter(
    gridX,
    gridY,
    tileHeight,
    mapWidth,
    mapHeight,
    "left-handed",
    BABYLON_TILE_MIN_HEIGHT,
    BABYLON_TILE_HEIGHT_SCALE,
  );
}

/**
 * Per-terrain flat textures applied to the 3D tiles. The top face uses the
 * top-down PMD texture; sides use the matching wall texture, or a darkened copy
 * of the top texture when no dedicated wall exists. Materials/textures are
 * cached per terrain type so a map allocates at most one pair per terrain.
 */
function createMaterialFactory(scene: Scene) {
  const textures: Texture[] = [];
  const topByGroup = new Map<VisualTerrainGroup, StandardMaterial>();
  const sideByGroup = new Map<VisualTerrainGroup, StandardMaterial>();

  function loadTexture(url: string): Texture {
    const texture = new Texture(url, scene, true, true, Texture.NEAREST_SAMPLINGMODE);
    texture.hasAlpha = true;
    // WRAP so the side texture tiles vertically per world unit (set via faceUV)
    // instead of stretching over a tall/half tile.
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    textures.push(texture);
    return texture;
  }

  function topMaterial(group: VisualTerrainGroup): StandardMaterial {
    const cached = topByGroup.get(group);
    if (cached) {
      return cached;
    }
    const material = new StandardMaterial(`top_${group}`, scene);
    material.diffuseTexture = loadTexture(`${TERRAIN_TEXTURE_BASE}/${group}-top.png`);
    material.emissiveColor = new Color3(1, 1, 1);
    material.disableLighting = true;
    material.specularColor = new Color3(0, 0, 0);
    topByGroup.set(group, material);
    return material;
  }

  function sideMaterial(group: VisualTerrainGroup): StandardMaterial {
    const cached = sideByGroup.get(group);
    if (cached) {
      return cached;
    }
    const hasOwnSide = DISTINCT_SIDE_GROUPS.has(group);
    const url = hasOwnSide
      ? `${TERRAIN_TEXTURE_BASE}/${group}-side.png`
      : `${TERRAIN_TEXTURE_BASE}/${group}-top.png`;
    const material = new StandardMaterial(`side_${group}`, scene);
    material.diffuseTexture = loadTexture(url);
    // Dedicated wall = full brightness; reused top = darkened to read as a flank.
    const shade = hasOwnSide ? 1 : BABYLON_SIDE_DARKEN;
    material.emissiveColor = new Color3(shade, shade, shade);
    material.disableLighting = true;
    material.specularColor = new Color3(0, 0, 0);
    sideByGroup.set(group, material);
    return material;
  }

  function dispose(): void {
    for (const texture of textures) {
      texture.dispose();
    }
    for (const material of topByGroup.values()) {
      material.dispose();
    }
    for (const material of sideByGroup.values()) {
      material.dispose();
    }
  }

  return { topMaterial, sideMaterial, dispose };
}

/**
 * Extrudes a `MapDefinition` into a grid of boxes. Each tile is a unit box scaled
 * on Y by its height; the top face is textured with the flat top-down PMD terrain
 * texture and the four sides with the matching wall texture.
 */
export function extrudeTerrain(scene: Scene, loaded: LoadedTiledMap): ExtrudedTerrain {
  const { map, visualTiles } = loaded;
  const { width, height } = map;
  const root = new TransformNode("terrain", scene);
  const factory = createMaterialFactory(scene);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = visualTiles[y]?.[x];
      if (!tile) {
        continue;
      }

      const totalHeight = tileBodyHeight(tile.height);

      // Side faces (0-3) tile the texture vertically over the tile height so a
      // half or tall tile keeps the same pixel size; top/bottom (4,5) stay 0..1.
      const sideUv = new Vector4(0, 0, 1, totalHeight);
      const topUv = new Vector4(0, 0, 1, 1);
      const faceUV = [sideUv, sideUv, sideUv, sideUv, topUv, topUv];

      const box = MeshBuilder.CreateBox(`tile_${x}_${y}`, { size: 1, faceUV, wrap: true }, scene);
      box.scaling.set(1, totalHeight, 1);
      const world = gridToWorldXZ(x, y, width, height);
      box.position.set(world.x, totalHeight / 2, world.z);
      box.parent = root;

      const top = factory.topMaterial(tile.group);
      const side = factory.sideMaterial(tile.group);
      const multi = new MultiMaterial(`tile_mat_${x}_${y}`, scene);
      multi.subMaterials = [side, side, side, side, top, top];
      box.material = multi;

      // Split the box into one SubMesh per face (6 verts each) so the 6-entry
      // MultiMaterial maps correctly — a default box has a single submesh that
      // would only ever use the first sub-material.
      const verticesCount = box.getTotalVertices();
      box.subMeshes = [];
      for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
        box.subMeshes.push(new SubMesh(faceIndex, 0, verticesCount, faceIndex * 6, 6, box));
      }

      // Pickable for ray-cast tile selection (3b); the grid coord rides on the
      // mesh so a pick decodes straight back to (x, y). Frozen world matrix is
      // still valid for picking — it just skips the per-frame recompute.
      box.isPickable = true;
      box.metadata = { tile: { x, y } } satisfies TileMeshMetadata;
      box.freezeWorldMatrix();
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
