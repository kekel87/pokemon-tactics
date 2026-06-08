import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGreasedLine } from "@babylonjs/core/Meshes/Builders/greasedLineBuilder";
import type { GreasedLineBaseMesh } from "@babylonjs/core/Meshes/GreasedLine/greasedLineBaseMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import {
  CURSOR_COLOR,
  TILE_HIGHLIGHT_ATTACK_COLOR,
  TILE_HIGHLIGHT_ENEMY_RANGE_ALPHA,
  TILE_HIGHLIGHT_ENEMY_RANGE_COLOR,
  TILE_HIGHLIGHT_MOVE_COLOR,
  TILE_HIGHLIGHT_RETREAT_COLOR,
  TILE_PREVIEW_ALPHA,
  TILE_PREVIEW_ATTACK_COLOR,
  TILE_PREVIEW_BLAST_INTERCEPT_COLOR,
  TILE_PREVIEW_BUFF_COLOR,
  TILE_RANGE_OUTLINE_ALPHA,
  TILE_RANGE_OUTLINE_COLOR,
} from "../constants.js";
import { HighlightKind } from "../enums/highlight-kind.js";
import { hexToColor3 } from "./babylon-color.js";
import {
  BABYLON_TILE_CURSOR_WIDTH,
  BABYLON_TILE_HIGHLIGHT_ALPHA,
  BABYLON_TILE_HIGHLIGHT_Z_OFFSET,
  BABYLON_TILE_OUTLINE_Y_OFFSET,
  BABYLON_TILE_PREVIEW_ALPHA_INDEX,
  BABYLON_TILE_RANGE_OUTLINE_WIDTH,
} from "./babylon-constants.js";

/** Preview kinds draw above the range highlights (the player's current focus). */
const PREVIEW_KINDS: ReadonlySet<HighlightKind> = new Set([
  HighlightKind.PreviewBuff,
  HighlightKind.PreviewAttack,
  HighlightKind.PreviewBlast,
]);

import { tileTopCenter } from "./terrain-extruder.js";

export interface TileHighlightPosition {
  readonly x: number;
  readonly y: number;
}

/** Returns the visual height (top) of a tile, for placing the overlay quad. */
export type TileHeightLookup = (x: number, y: number) => number;

const FILL_STYLE_BY_KIND: Readonly<Record<HighlightKind, { color: number; alpha: number }>> = {
  [HighlightKind.Move]: { color: TILE_HIGHLIGHT_MOVE_COLOR, alpha: BABYLON_TILE_HIGHLIGHT_ALPHA },
  [HighlightKind.Attack]: {
    color: TILE_HIGHLIGHT_ATTACK_COLOR,
    alpha: BABYLON_TILE_HIGHLIGHT_ALPHA,
  },
  [HighlightKind.Retreat]: {
    color: TILE_HIGHLIGHT_RETREAT_COLOR,
    alpha: BABYLON_TILE_HIGHLIGHT_ALPHA,
  },
  [HighlightKind.EnemyRange]: {
    color: TILE_HIGHLIGHT_ENEMY_RANGE_COLOR,
    alpha: TILE_HIGHLIGHT_ENEMY_RANGE_ALPHA,
  },
  [HighlightKind.PreviewBuff]: { color: TILE_PREVIEW_BUFF_COLOR, alpha: TILE_PREVIEW_ALPHA },
  [HighlightKind.PreviewAttack]: { color: TILE_PREVIEW_ATTACK_COLOR, alpha: TILE_PREVIEW_ALPHA },
  [HighlightKind.PreviewBlast]: {
    color: TILE_PREVIEW_BLAST_INTERCEPT_COLOR,
    alpha: TILE_PREVIEW_ALPHA,
  },
};

/**
 * Tile-range overlays for the Babylon combat scene: per-kind flat fill quads
 * (move/attack/retreat/enemy), a range outline (external edges only), and a
 * hover cursor. Quads sit a hair above each tile's own top so they ride the
 * extruded terrain at any height and get occluded by taller terrain in front
 * (renderingGroupId 0 = depth-tested against the terrain). Mirrors the 2D
 * `IsometricGrid.highlightTiles` / `highlightTilesOutline` behaviour.
 */
/** One team's spawn zone, painted with its own colour/alpha (placement phase). */
export interface SpawnZoneHighlight {
  readonly positions: readonly TileHighlightPosition[];
  readonly color: number;
  readonly alpha: number;
}

export interface TileHighlights {
  /** Replace the fill set for one highlight kind (empty clears that kind). */
  set(kind: HighlightKind, positions: readonly TileHighlightPosition[]): void;
  /** Replace the spawn-zone fills (per-zone colour/alpha; empty clears them). */
  setSpawnZones(zones: readonly SpawnZoneHighlight[]): void;
  /** Replace the range outline (drawn on the external edges of the set); `color` overrides the default. */
  setOutline(positions: readonly TileHighlightPosition[], color?: number): void;
  /** Move the hover cursor to a tile, or hide it (`null`). */
  setCursor(position: TileHighlightPosition | null): void;
  /** Clear every fill kind + spawn zones + outline (keeps the cursor). */
  clear(): void;
  dispose(): void;
}

export function createTileHighlights(
  scene: Scene,
  heightAt: TileHeightLookup,
  mapWidth: number,
  mapHeight: number,
): TileHighlights {
  const root = new TransformNode("tile_highlights", scene);

  // One shared transparent material per kind (emissive flat fill, double-sided).
  const materialByKind = new Map<HighlightKind, StandardMaterial>();
  function fillMaterial(kind: HighlightKind): StandardMaterial {
    const cached = materialByKind.get(kind);
    if (cached) {
      return cached;
    }
    const style = FILL_STYLE_BY_KIND[kind];
    const material = new StandardMaterial(`highlight_${kind}`, scene);
    material.emissiveColor = hexToColor3(style.color);
    material.disableLighting = true;
    material.specularColor = new Color3(0, 0, 0);
    material.alpha = style.alpha;
    material.backFaceCulling = false;
    // Win the depth tie with the coplanar tile top without a screen-shifting lift.
    material.zOffset = BABYLON_TILE_HIGHLIGHT_Z_OFFSET;
    materialByKind.set(kind, material);
    return material;
  }

  // Per-kind parent so a `set` can dispose just that kind's quads.
  const parentByKind = new Map<HighlightKind, TransformNode>();
  function parentFor(kind: HighlightKind): TransformNode {
    const cached = parentByKind.get(kind);
    if (cached) {
      return cached;
    }
    const node = new TransformNode(`highlight_parent_${kind}`, scene);
    node.parent = root;
    parentByKind.set(kind, node);
    return node;
  }

  const inBounds = (x: number, y: number): boolean =>
    x >= 0 && x < mapWidth && y >= 0 && y < mapHeight;

  /** Exact top-face centre (world) of a tile. Fills sit flush here (depth via zOffset). */
  function topAt(x: number, y: number): Vector3 {
    const center = tileTopCenter(x, y, heightAt(x, y), mapWidth, mapHeight);
    return new Vector3(center.x, center.y, center.z);
  }

  function set(kind: HighlightKind, positions: readonly TileHighlightPosition[]): void {
    const parent = parentFor(kind);
    for (const child of parent.getChildMeshes()) {
      child.dispose();
    }
    const material = fillMaterial(kind);
    // Preview fills sort above the range highlights / grass / Champs (explicit alphaIndex).
    const isPreview = PREVIEW_KINDS.has(kind);
    for (const position of positions) {
      if (!inBounds(position.x, position.y)) {
        continue;
      }
      const quad = MeshBuilder.CreateGround(
        `highlight_${kind}_${position.x}_${position.y}`,
        { width: 1, height: 1 },
        scene,
      );
      const top = topAt(position.x, position.y);
      quad.position.set(top.x, top.y, top.z);
      quad.material = material;
      quad.isPickable = false;
      quad.parent = parent;
      if (isPreview) {
        quad.alphaIndex = BABYLON_TILE_PREVIEW_ALPHA_INDEX;
      }
    }
  }

  // Spawn-zone quads carry per-zone colours, so their materials are rebuilt on
  // every call instead of being cached by kind.
  const spawnRoot = new TransformNode("highlight_spawn_zones", scene);
  spawnRoot.parent = root;
  let spawnMaterials: StandardMaterial[] = [];

  function clearSpawnZones(): void {
    for (const child of spawnRoot.getChildMeshes()) {
      child.dispose();
    }
    for (const material of spawnMaterials) {
      material.dispose();
    }
    spawnMaterials = [];
  }

  function setSpawnZones(zones: readonly SpawnZoneHighlight[]): void {
    clearSpawnZones();
    for (let zoneIndex = 0; zoneIndex < zones.length; zoneIndex++) {
      const zone = zones[zoneIndex];
      if (!zone) {
        continue;
      }
      const material = new StandardMaterial(`highlight_spawn_${zoneIndex}`, scene);
      material.emissiveColor = hexToColor3(zone.color);
      material.disableLighting = true;
      material.specularColor = new Color3(0, 0, 0);
      material.alpha = zone.alpha;
      material.backFaceCulling = false;
      material.zOffset = BABYLON_TILE_HIGHLIGHT_Z_OFFSET;
      spawnMaterials.push(material);
      for (const position of zone.positions) {
        if (!inBounds(position.x, position.y)) {
          continue;
        }
        const quad = MeshBuilder.CreateGround(
          `highlight_spawn_${zoneIndex}_${position.x}_${position.y}`,
          { width: 1, height: 1 },
          scene,
        );
        const top = topAt(position.x, position.y);
        quad.position.set(top.x, top.y, top.z);
        quad.material = material;
        quad.isPickable = false;
        quad.parent = spawnRoot;
      }
    }
  }

  let outline: GreasedLineBaseMesh | null = null;
  function setOutline(
    positions: readonly TileHighlightPosition[],
    color: number = TILE_RANGE_OUTLINE_COLOR,
  ): void {
    outline?.dispose();
    outline = null;
    const onGrid = positions.filter((p) => inBounds(p.x, p.y));
    if (onGrid.length === 0) {
      return;
    }
    const inSet = new Set(onGrid.map((p) => `${p.x},${p.y}`));
    const lines: Vector3[][] = [];
    for (const { x, y } of onGrid) {
      const top = topAt(x, y);
      const lineY = top.y + BABYLON_TILE_OUTLINE_Y_OFFSET;
      const minX = top.x - 0.5;
      const maxX = top.x + 0.5;
      const minZ = top.z - 0.5;
      const maxZ = top.z + 0.5;
      // gridX → world Z, gridY → world X (see terrain-extruder.gridToWorldXZ):
      // a neighbour absent from the set means that edge is on the range border.
      if (!inSet.has(`${x + 1},${y}`)) {
        lines.push([new Vector3(minX, lineY, maxZ), new Vector3(maxX, lineY, maxZ)]);
      }
      if (!inSet.has(`${x - 1},${y}`)) {
        lines.push([new Vector3(minX, lineY, minZ), new Vector3(maxX, lineY, minZ)]);
      }
      if (!inSet.has(`${x},${y + 1}`)) {
        lines.push([new Vector3(maxX, lineY, minZ), new Vector3(maxX, lineY, maxZ)]);
      }
      if (!inSet.has(`${x},${y - 1}`)) {
        lines.push([new Vector3(minX, lineY, minZ), new Vector3(minX, lineY, maxZ)]);
      }
    }
    // GreasedLine (not CreateLineSystem) so the perimeter has a real world-space
    // thickness instead of a 1px hairline.
    outline = CreateGreasedLine(
      "highlight_outline",
      { points: lines },
      { color: hexToColor3(color), width: BABYLON_TILE_RANGE_OUTLINE_WIDTH },
      scene,
    );
    if (outline.material) {
      outline.material.alpha = TILE_RANGE_OUTLINE_ALPHA;
    }
    outline.isPickable = false;
    outline.parent = root;
  }

  // The tile cursor is a thick yellow outline of the hovered tile top: a unit
  // square loop repositioned per hover (GreasedLine — see design-system.md).
  let cursor: GreasedLineBaseMesh | null = null;
  function setCursor(position: TileHighlightPosition | null): void {
    if (!position || !inBounds(position.x, position.y)) {
      cursor?.setEnabled(false);
      return;
    }
    if (!cursor) {
      // Inset by the stroke half-width so the square lies fully INSIDE the tile —
      // a centred stroke would hang half over the edge and clip into a taller
      // neighbouring tile's wall.
      const half = 0.5 - BABYLON_TILE_CURSOR_WIDTH / 2;
      cursor = CreateGreasedLine(
        "highlight_cursor",
        {
          points: [
            new Vector3(-half, 0, -half),
            new Vector3(half, 0, -half),
            new Vector3(half, 0, half),
            new Vector3(-half, 0, half),
            new Vector3(-half, 0, -half),
          ],
        },
        { color: hexToColor3(CURSOR_COLOR), width: BABYLON_TILE_CURSOR_WIDTH },
        scene,
      );
      cursor.isPickable = false;
      cursor.parent = root;
    }
    const top = topAt(position.x, position.y);
    cursor.position.set(top.x, top.y + BABYLON_TILE_OUTLINE_Y_OFFSET, top.z);
    cursor.setEnabled(true);
  }

  function clear(): void {
    for (const parent of parentByKind.values()) {
      for (const child of parent.getChildMeshes()) {
        child.dispose();
      }
    }
    clearSpawnZones();
    outline?.dispose();
    outline = null;
  }

  return {
    set,
    setSpawnZones,
    setOutline,
    setCursor,
    clear,
    dispose: () => {
      // `root.dispose(false, true)` recurses into every child mesh (quads, cursor,
      // outline) — only the shared materials need an explicit dispose.
      root.dispose(false, true);
      for (const material of materialByKind.values()) {
        material.dispose();
      }
      for (const material of spawnMaterials) {
        material.dispose();
      }
    },
  };
}
