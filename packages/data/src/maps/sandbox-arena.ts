import type { MapDefinition, TileState } from "@pokemon-tactic/core";
import { TerrainType } from "@pokemon-tactic/core";

function buildFlatTiles(width: number, height: number): TileState[][] {
  const tiles = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push({
        position: { x, y },
        height: 0,
        terrain: TerrainType.Normal,
        occupantId: null,
        isPassable: true,
      });
    }
    tiles.push(row);
  }
  return tiles;
}

export const sandboxArena: MapDefinition = {
  id: "sandbox-arena",
  name: "Sandbox Arena",
  width: 6,
  height: 6,
  tiles: buildFlatTiles(6, 6),
  formats: [
    {
      teamCount: 2,
      maxPokemonPerTeam: 1,
      spawnZones: [
        {
          positions: [{ x: 1, y: 3 }],
        },
        {
          positions: [{ x: 4, y: 3 }],
        },
      ],
    },
  ],
};
