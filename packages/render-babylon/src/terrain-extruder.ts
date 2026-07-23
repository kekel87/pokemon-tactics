import { Material } from "@babylonjs/core/Materials/material";
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
  isLiquidGroup,
  type LoadedTiledMap,
  gridToWorldXZ as sharedGridToWorldXZ,
  tileBodyHeight as sharedTileBodyHeight,
  tileTopCenter as sharedTileTopCenter,
  type VisualTerrainGroup,
} from "@pokemon-tactic/view-core";
import {
  BABYLON_LIQUID_ALPHA_BY_GROUP,
  BABYLON_LIQUID_DEPTH_RATIO,
  BABYLON_LIQUID_SHIMMER_BY_GROUP,
  BABYLON_LIQUID_SURFACE_ALPHA_INDEX,
  BABYLON_LIQUID_SURFACE_RATIO,
  BABYLON_LIQUID_WATER_ALPHA,
  BABYLON_SIDE_DARKEN,
  BABYLON_SPRITE_RENDERING_GROUP,
  BABYLON_TILE_CENTER_MARKER_COLOR,
  BABYLON_TILE_GRID_COLOR,
  BABYLON_TILE_GRID_Z_OFFSET,
  BABYLON_TILE_HEIGHT_SCALE,
  BABYLON_TILE_MIN_HEIGHT,
} from "./babylon-constants.js";
import { LiquidShimmerPlugin } from "./shaders/liquid-shimmer-plugin.js";

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
  const waterByGroup = new Map<VisualTerrainGroup, StandardMaterial>();
  // Animated glow/ripple plugins on the liquid surface materials; the scene advances their
  // `time` each frame (see `extrudeTerrain`). Disposed with their host material.
  const shimmerPlugins: LiquidShimmerPlugin[] = [];

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

  /**
   * Translucent surface material for a walkable liquid (plan 166): the group's top
   * texture drawn alpha-blended so the sand floor + submerged walls show through.
   * `disableDepthWrite` keeps it from occluding sprites/terrain drawn after it; the
   * depth *test* stays on so taller terrain in front still hides it. Mirrors the
   * translucent pattern already in `babylon-field-terrains.ts`.
   */
  function waterMaterial(group: VisualTerrainGroup): StandardMaterial {
    const cached = waterByGroup.get(group);
    if (cached) {
      return cached;
    }
    const material = new StandardMaterial(`water_${group}`, scene);
    material.diffuseTexture = loadTexture(`${TERRAIN_TEXTURE_BASE}/${group}-top.png`);
    material.emissiveColor = new Color3(1, 1, 1);
    material.disableLighting = true;
    material.specularColor = new Color3(0, 0, 0);
    material.transparencyMode = Material.MATERIAL_ALPHABLEND;
    material.alpha = BABYLON_LIQUID_ALPHA_BY_GROUP[group] ?? BABYLON_LIQUID_WATER_ALPHA;
    material.disableDepthWrite = true;
    const shimmer = BABYLON_LIQUID_SHIMMER_BY_GROUP[group];
    if (shimmer) {
      shimmerPlugins.push(new LiquidShimmerPlugin(material, shimmer));
    }
    waterByGroup.set(group, material);
    return material;
  }

  /**
   * A single fully-transparent material for culled side faces (plan 166): the interior
   * walls between two adjacent liquid tiles are hidden so they don't read as submerged
   * "walls" through the translucent surface. Shared across every tile.
   */
  let invisible: StandardMaterial | undefined;
  function invisibleMaterial(): StandardMaterial {
    if (invisible) {
      return invisible;
    }
    const material = new StandardMaterial("liquid_culled_side", scene);
    material.disableLighting = true;
    material.alpha = 0;
    material.transparencyMode = Material.MATERIAL_ALPHABLEND;
    material.disableDepthWrite = true;
    invisible = material;
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
    for (const material of waterByGroup.values()) {
      material.dispose();
    }
    invisible?.dispose();
  }

  return { topMaterial, sideMaterial, waterMaterial, invisibleMaterial, shimmerPlugins, dispose };
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

  const liquidNeighbour = (nx: number, ny: number): boolean => {
    const group = visualTiles[ny]?.[nx]?.group;
    return group !== undefined && isLiquidGroup(group);
  };

  /**
   * Side faces to hide for a liquid tile (plan 166): a wall shared with an adjacent
   * liquid tile would read as a "wall under the water", so it's culled — only walls
   * against solid ground / the map edge stay. Order matches Babylon box side faces
   * 0-3 (see `buildTile`): [+Z (x+1), −Z (x−1), +X (y+1), −X (y−1)] in this left-handed
   * binding (gridX→worldZ, gridY→worldX). Non-liquid tiles cull nothing.
   */
  const liquidCulledSides = (x: number, y: number): [boolean, boolean, boolean, boolean] => [
    liquidNeighbour(x + 1, y),
    liquidNeighbour(x - 1, y),
    liquidNeighbour(x, y + 1),
    liquidNeighbour(x, y - 1),
  ];

  /**
   * A textured box occupying `[baseY, baseY + boxHeight]` on Y — the building block for
   * every tile (full terrain, or a liquid floor / body / surface). `topMaterial` textures
   * the top + bottom, `sideMaterial` the four walls, except walls flagged in `culledSides`
   * (hidden via a transparent material). `transparent` routes the box into the sprite group
   * with an alpha index so a translucent surface draws over a submerged sprite.
   */
  function buildTile(options: {
    name: string;
    world: { x: number; z: number };
    baseY: number;
    boxHeight: number;
    topMaterial: StandardMaterial;
    sideMaterial: StandardMaterial;
    culledSides: readonly [boolean, boolean, boolean, boolean];
    metadata: TileMeshMetadata | undefined;
    transparent: boolean;
  }): void {
    const { name, world, baseY, boxHeight, culledSides, metadata, transparent } = options;
    // Side faces (0-3) tile the texture vertically over the box height so a half or
    // tall box keeps the same pixel size; top/bottom (4,5) stay 0..1.
    const sideUv = new Vector4(0, 0, 1, boxHeight);
    const topUv = new Vector4(0, 0, 1, 1);
    const faceUV = [sideUv, sideUv, sideUv, sideUv, topUv, topUv];

    const box = MeshBuilder.CreateBox(name, { size: 1, faceUV, wrap: true }, scene);
    box.scaling.set(1, boxHeight, 1);
    box.position.set(world.x, baseY + boxHeight / 2, world.z);
    box.parent = root;

    const culled = factory.invisibleMaterial();
    const wallOf = (index: number): StandardMaterial =>
      culledSides[index] ? culled : options.sideMaterial;
    const multi = new MultiMaterial(`${name}_mat`, scene);
    multi.subMaterials = [
      wallOf(0),
      wallOf(1),
      wallOf(2),
      wallOf(3),
      options.topMaterial,
      options.topMaterial,
    ];
    box.material = multi;

    // Split the box into one SubMesh per face (6 verts each) so the 6-entry
    // MultiMaterial maps correctly — a default box has a single submesh that
    // would only ever use the first sub-material.
    const verticesCount = box.getTotalVertices();
    box.subMeshes = [];
    for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
      box.subMeshes.push(new SubMesh(faceIndex, 0, verticesCount, faceIndex * 6, 6, box));
    }

    // Pickable for ray-cast tile selection (3b); the grid coord rides on the mesh so a
    // pick decodes straight back to (x, y). A liquid's floor/body carries the pick; the
    // separate translucent surface slab stays non-pickable. Frozen world matrix is still
    // valid for picking — it just skips the per-frame recompute.
    box.isPickable = metadata !== undefined;
    if (metadata) {
      box.metadata = metadata;
    }
    if (transparent) {
      box.alphaIndex = BABYLON_LIQUID_SURFACE_ALPHA_INDEX;
      // Draw in the sprite group so the surface renders AFTER the billboards → a submerged
      // sprite is seen THROUGH the water. Depth stays shared (autoclear off) so terrain in
      // front still occludes it; the water material's `disableDepthWrite` keeps it from
      // burying the sprites drawn before it.
      box.renderingGroupId = BABYLON_SPRITE_RENDERING_GROUP;
    }
    box.freezeWorldMatrix();
  }

  const noCull = [false, false, false, false] as const;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = visualTiles[y]?.[x];
      if (!tile) {
        continue;
      }

      const totalHeight = tileBodyHeight(tile.height);
      const world = gridToWorldXZ(x, y, width, height);
      const name = `tile_${x}_${y}`;
      const meta = { tile: { x, y } } satisfies TileMeshMetadata;

      if (tile.group === "deep_water" || tile.group === "lava") {
        // Deep/full liquids (deep water, lava): one single column 0→5/6, no separate floor —
        // deep water reads bottomless, lava reads as a solid molten body (both would show an
        // ugly two-tone half-block seam at 3/6 if split like shallow water). Drawn over
        // submerged sprites; interior walls culled so a pool merges seamlessly. Lava's near-
        // opaque alpha (0.99) hides a submerged sprite's legs; deep water's stays see-through.
        buildTile({
          name,
          world,
          baseY: 0,
          boxHeight: totalHeight * BABYLON_LIQUID_SURFACE_RATIO,
          topMaterial: factory.waterMaterial(tile.group),
          sideMaterial: factory.waterMaterial(tile.group),
          culledSides: liquidCulledSides(x, y),
          metadata: meta,
          transparent: true,
        });
      } else if (isLiquidGroup(tile.group)) {
        // Shallow liquids (water, swamp): a sand floor 0→3/6 (carries the pick, sits below the
        // sprite's feet so it never X-ray-silhouettes the body, and reads as a bank through the
        // translucent water) + a translucent surface slab 3/6→5/6 drawn over the submerged
        // sprite. Lava and deep water take the single full-column branch above instead.
        buildTile({
          name,
          world,
          baseY: 0,
          boxHeight: totalHeight * BABYLON_LIQUID_DEPTH_RATIO,
          topMaterial: factory.topMaterial("sable"),
          sideMaterial: factory.sideMaterial("sable"),
          culledSides: liquidCulledSides(x, y),
          metadata: meta,
          transparent: false,
        });
        buildTile({
          name: `liquid_surface_${x}_${y}`,
          world,
          baseY: totalHeight * BABYLON_LIQUID_DEPTH_RATIO,
          boxHeight: totalHeight * (BABYLON_LIQUID_SURFACE_RATIO - BABYLON_LIQUID_DEPTH_RATIO),
          topMaterial: factory.waterMaterial(tile.group),
          sideMaterial: factory.waterMaterial(tile.group),
          culledSides: liquidCulledSides(x, y),
          metadata: undefined,
          transparent: true,
        });
      } else {
        buildTile({
          name,
          world,
          baseY: 0,
          boxHeight: totalHeight,
          topMaterial: factory.topMaterial(tile.group),
          sideMaterial: factory.sideMaterial(tile.group),
          culledSides: noCull,
          metadata: meta,
          transparent: false,
        });
      }
    }
  }

  // Drive the liquid surface glow/ripple: advance every shimmer plugin's clock once per frame.
  // Only registered when the map actually has animated liquids (materials are created lazily
  // during the tile loop above, so `shimmerPlugins` is populated by now).
  let shimmerElapsedSeconds = 0;
  const shimmerObserver =
    factory.shimmerPlugins.length > 0
      ? scene.onBeforeRenderObservable.add(() => {
          shimmerElapsedSeconds += scene.getEngine().getDeltaTime() / 1000;
          for (const plugin of factory.shimmerPlugins) {
            plugin.time = shimmerElapsedSeconds;
          }
        })
      : null;

  return {
    root,
    worldWidth: width,
    worldDepth: height,
    dispose: () => {
      if (shimmerObserver) {
        scene.onBeforeRenderObservable.remove(shimmerObserver);
      }
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
