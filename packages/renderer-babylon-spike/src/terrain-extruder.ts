import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";
import { SubMesh } from "@babylonjs/core/Meshes/subMesh";
import { GridMaterial } from "@babylonjs/materials/grid/gridMaterial";
import type { Scene } from "@babylonjs/core/scene";
import type { LoadedTiledMap } from "./load-tiled-map.js";

const TERRAIN_COLORS: Record<string, number> = {
  normal: 0x6a8f3e,
  tall_grass: 0x4a7c2c,
  obstacle: 0x5a4a3a,
  water: 0x3a6f9e,
  deep_water: 0x1e4a7a,
  magma: 0x3a2a2a,
  lava: 0xe04a20,
  ice: 0xb8d8e8,
  sand: 0xd8c890,
  snow: 0xe8f0f4,
  swamp: 0x5a6a3a,
};
const SIDE_DARKEN = 0.65;

function hexToColor3(hex: number): Color3 {
  return new Color3(((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255);
}

export interface ExtrudedTerrain {
  readonly root: TransformNode;
  readonly worldWidth: number;
  readonly worldDepth: number;
}

export function extrudeTerrain(scene: Scene, loaded: LoadedTiledMap): ExtrudedTerrain {
  const { map } = loaded;
  const { width, height } = map;
  const root = new TransformNode("terrain", scene);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = map.tiles[y]?.[x];
      if (!tile) continue;

      const baseHeight = 0.5;
      const totalHeight = Math.max(baseHeight, tile.height + baseHeight);

      const topColorHex = TERRAIN_COLORS[tile.terrain] ?? 0x808080;
      const topColor = hexToColor3(topColorHex);
      const sideColor = topColor.scale(SIDE_DARKEN);

      const box = MeshBuilder.CreateBox(`tile_${x}_${y}`, { size: 1 }, scene);
      box.scaling.set(1, totalHeight, 1);
      box.position.set(x - width / 2 + 0.5, totalHeight / 2, y - height / 2 + 0.5);
      box.parent = root;

      const multi = new MultiMaterial(`tile_mat_${x}_${y}`, scene);
      const top = new GridMaterial(`tile_top_${x}_${y}`, scene);
      top.mainColor = topColor;
      top.lineColor = new Color3(0.1, 0.1, 0.15);
      top.gridRatio = 1;
      top.gridOffset = new Vector3(0.5, 0, 0.5);
      top.majorUnitFrequency = 0;
      top.minorUnitVisibility = 0.65;
      top.opacity = 1;
      const side = new StandardMaterial(`tile_side_${x}_${y}`, scene);
      side.diffuseColor = sideColor;
      side.specularColor = new Color3(0, 0, 0);
      multi.subMaterials = [side, side, side, side, top, top];
      box.material = multi;

      const verticesCount = box.getTotalVertices();
      box.subMeshes = [];
      for (let faceIndex = 0; faceIndex < 6; faceIndex++) {
        box.subMeshes.push(new SubMesh(faceIndex, 0, verticesCount, faceIndex * 6, 6, box));
      }
    }
  }

  return { root, worldWidth: width, worldDepth: height };
}
