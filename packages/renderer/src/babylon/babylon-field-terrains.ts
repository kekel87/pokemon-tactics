import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGreasedLine } from "@babylonjs/core/Meshes/Builders/greasedLineBuilder";
import type { GreasedLineBaseMesh } from "@babylonjs/core/Meshes/GreasedLine/greasedLineBaseMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { FIELD_TERRAIN_OUTLINE_ALPHA } from "../constants.js";
import { type ChampPill, createChampPill } from "./babylon-champ-pill.js";
import { hexToColor3 } from "./babylon-color.js";
import {
  BABYLON_CHAMP_PILL_LIFT,
  BABYLON_FIELD_TERRAIN_ALPHA_INDEX,
  BABYLON_FIELD_TERRAIN_FILL_ALPHA,
  BABYLON_FIELD_TERRAIN_OUTLINE_WIDTH,
  BABYLON_TILE_HIGHLIGHT_Z_OFFSET,
  BABYLON_TILE_OUTLINE_Y_OFFSET,
} from "./babylon-constants.js";
import type { TileHeightLookup, TileHighlightPosition } from "./babylon-tile-highlights.js";
import { tileTopCenter } from "./terrain-extruder.js";

/**
 * One active field terrain ("Champs") zone to paint. Mirrors the 2D renderer's
 * `FieldTerrainRenderSpec` — engine state (BattleState.fieldTerrains) feeds these
 * at Jalon 4; Jalon 3e drives them from a static demo.
 */
export interface FieldTerrainSpec {
  /** Every tile inside the zone (Manhattan diamond, already clipped to the grid). */
  readonly tiles: readonly TileHighlightPosition[];
  /** Where the timer pill sits (the setter's target tile). */
  readonly anchor: TileHighlightPosition;
  /** Zone identity colour (which Champ) — fill + perimeter. */
  readonly color: number;
  /** Owning team colour — pill background, so the player can tell whose Champ it is. */
  readonly teamColor: number;
  /** Turns left, shown in the pill. */
  readonly remainingTurns: number;
}

export interface FieldTerrains {
  /** Replace every painted zone (empty clears). Idempotent. */
  set(specs: readonly FieldTerrainSpec[]): void;
  dispose(): void;
}

/**
 * Field-terrain ("Champs") zone rendering for the Babylon combat scene (Jalon 3e):
 * a soft colour fill over the ground (above the grass), a bright GreasedLine
 * perimeter on the zone's external edges, and an in-engine billboarded counter
 * badge (decision #487). Mirrors `IsometricGrid.renderFieldTerrains`.
 *
 * The fill rides each tile's own top (occluded by taller terrain in front, like the
 * range highlights). The perimeter uses GreasedLine so a future polish pass can add
 * glow / a floating bob without changing the rendering tech.
 */
export function createFieldTerrains(
  scene: Scene,
  heightAt: TileHeightLookup,
  mapWidth: number,
  mapHeight: number,
): FieldTerrains {
  const root = new TransformNode("field_terrains", scene);
  // Disposed + rebuilt on each `set`.
  let zoneParents: TransformNode[] = [];
  let materials: StandardMaterial[] = [];
  let outlines: GreasedLineBaseMesh[] = [];
  let pills: ChampPill[] = [];

  const inBounds = (x: number, y: number): boolean =>
    x >= 0 && x < mapWidth && y >= 0 && y < mapHeight;

  function topAt(x: number, y: number): { x: number; y: number; z: number } {
    return tileTopCenter(x, y, heightAt(x, y), mapWidth, mapHeight);
  }

  function clear(): void {
    for (const parent of zoneParents) {
      parent.dispose(false, true);
    }
    for (const material of materials) {
      material.dispose();
    }
    for (const outline of outlines) {
      outline.dispose();
    }
    for (const pill of pills) {
      pill.dispose();
    }
    zoneParents = [];
    materials = [];
    outlines = [];
    pills = [];
  }

  function paintZone(spec: FieldTerrainSpec): void {
    const onGrid = spec.tiles.filter((tile) => inBounds(tile.x, tile.y));
    if (onGrid.length === 0) {
      return;
    }
    const parent = new TransformNode(`field_terrain_${spec.anchor.x}_${spec.anchor.y}`, scene);
    parent.parent = root;
    zoneParents.push(parent);

    // Zones never overlap (the engine clears any overlapped tiles when a new Champ is set).
    const color3 = hexToColor3(spec.color);
    const material = new StandardMaterial(`field_terrain_fill_${spec.color}`, scene);
    material.emissiveColor = color3;
    material.disableLighting = true;
    material.specularColor = new Color3(0, 0, 0);
    material.transparencyMode = Material.MATERIAL_ALPHABLEND;
    material.alpha = BABYLON_FIELD_TERRAIN_FILL_ALPHA;
    material.disableDepthWrite = true;
    material.backFaceCulling = false;
    // Win the depth tie with the coplanar tile top without a screen-shifting lift.
    material.zOffset = BABYLON_TILE_HIGHLIGHT_Z_OFFSET;
    materials.push(material);

    const inSet = new Set(onGrid.map((tile) => `${tile.x},${tile.y}`));
    const borderLines: Vector3[][] = [];
    for (const { x, y } of onGrid) {
      const top = topAt(x, y);
      const quad = MeshBuilder.CreateGround(
        `field_terrain_${spec.color}_${x}_${y}`,
        { width: 1, height: 1 },
        scene,
      );
      quad.position.set(top.x, top.y, top.z);
      quad.material = material;
      quad.alphaIndex = BABYLON_FIELD_TERRAIN_ALPHA_INDEX;
      quad.isPickable = false;
      quad.parent = parent;

      // Perimeter: a neighbour absent from the set means that edge is on the border.
      // gridX → world Z, gridY → world X (see terrain-extruder.gridToWorldXZ).
      // Stroke inset by its half-width so it lies fully inside the tile (no clip
      // into a taller neighbouring tile's wall).
      const inset = BABYLON_FIELD_TERRAIN_OUTLINE_WIDTH / 2;
      const lineY = top.y + BABYLON_TILE_OUTLINE_Y_OFFSET;
      const minX = top.x - 0.5;
      const maxX = top.x + 0.5;
      const minZ = top.z - 0.5;
      const maxZ = top.z + 0.5;
      if (!inSet.has(`${x + 1},${y}`)) {
        const z = maxZ - inset;
        borderLines.push([new Vector3(minX, lineY, z), new Vector3(maxX, lineY, z)]);
      }
      if (!inSet.has(`${x - 1},${y}`)) {
        const z = minZ + inset;
        borderLines.push([new Vector3(minX, lineY, z), new Vector3(maxX, lineY, z)]);
      }
      if (!inSet.has(`${x},${y + 1}`)) {
        const lineX = maxX - inset;
        borderLines.push([new Vector3(lineX, lineY, minZ), new Vector3(lineX, lineY, maxZ)]);
      }
      if (!inSet.has(`${x},${y - 1}`)) {
        const lineX = minX + inset;
        borderLines.push([new Vector3(lineX, lineY, minZ), new Vector3(lineX, lineY, maxZ)]);
      }
    }

    if (borderLines.length > 0) {
      const outline = CreateGreasedLine(
        `field_terrain_outline_${spec.anchor.x}_${spec.anchor.y}`,
        { points: borderLines },
        { color: color3, width: BABYLON_FIELD_TERRAIN_OUTLINE_WIDTH },
        scene,
      );
      outline.isPickable = false;
      outline.parent = root;
      const outlineMaterial = outline.material;
      if (outlineMaterial) {
        outlineMaterial.alpha = FIELD_TERRAIN_OUTLINE_ALPHA;
      }
      outlines.push(outline);
    }

    // In-engine counter badge, billboarded above the anchor tile (team = fill,
    // Champ = border ring), floating a little so it reads over the zone.
    if (inBounds(spec.anchor.x, spec.anchor.y)) {
      const pill = createChampPill(scene, {
        remainingTurns: spec.remainingTurns,
        teamColor: spec.teamColor,
        borderColor: spec.color,
      });
      const anchorTop = topAt(spec.anchor.x, spec.anchor.y);
      pill.mesh.position.set(anchorTop.x, anchorTop.y + BABYLON_CHAMP_PILL_LIFT, anchorTop.z);
      pill.mesh.parent = root;
      pills.push(pill);
    }
  }

  return {
    set: (specs) => {
      clear();
      for (const spec of specs) {
        paintZone(spec);
      }
    },
    dispose: () => {
      // `clear()` already freed every zone (meshes, materials, badges); recurse
      // anyway, matching the `babylon-tile-highlights` dispose pattern.
      clear();
      root.dispose(false, true);
    },
  };
}
