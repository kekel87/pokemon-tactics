import * as THREE from "three";
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

interface ExtrudedTerrain {
  readonly group: THREE.Group;
  readonly worldWidth: number;
  readonly worldDepth: number;
}

export function extrudeTerrain(loaded: LoadedTiledMap): ExtrudedTerrain {
  const { map } = loaded;
  const { width, height } = map;
  const group = new THREE.Group();

  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = map.tiles[y]?.[x];
      if (!tile) continue;

      const baseHeight = 0.5;
      const totalHeight = Math.max(baseHeight, tile.height + baseHeight);

      const topColor = TERRAIN_COLORS[tile.terrain] ?? 0x808080;
      const sideColor = new THREE.Color(topColor).multiplyScalar(SIDE_DARKEN).getHex();

      const materials = [
        new THREE.MeshStandardMaterial({ color: sideColor }),
        new THREE.MeshStandardMaterial({ color: sideColor }),
        new THREE.MeshStandardMaterial({ color: topColor }),
        new THREE.MeshStandardMaterial({ color: topColor }),
        new THREE.MeshStandardMaterial({ color: sideColor }),
        new THREE.MeshStandardMaterial({ color: sideColor }),
      ];

      const mesh = new THREE.Mesh(boxGeometry, materials);
      mesh.scale.set(1, totalHeight, 1);
      mesh.position.set(
        x - width / 2 + 0.5,
        totalHeight / 2,
        y - height / 2 + 0.5,
      );
      group.add(mesh);
    }
  }

  return {
    group,
    worldWidth: width,
    worldDepth: height,
  };
}
