import type { MapDefinition } from "@pokemon-tactic/core";
import { TerrainType } from "@pokemon-tactic/core";

function buildFlatTiles(width: number, height: number) {
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

export const pocArena: MapDefinition = {
  id: "poc-arena",
  name: "POC Arena",
  width: 12,
  height: 12,
  tiles: buildFlatTiles(12, 12),
  formats: [
    {
      teamCount: 2,
      maxPokemonPerTeam: 2,
      spawnZones: [
        {
          positions: [
            { x: 0, y: 9 },
            { x: 1, y: 9 },
            { x: 2, y: 9 },
            { x: 0, y: 10 },
            { x: 1, y: 10 },
            { x: 2, y: 10 },
            { x: 0, y: 11 },
            { x: 1, y: 11 },
            { x: 2, y: 11 },
          ],
        },
        {
          positions: [
            { x: 9, y: 0 },
            { x: 10, y: 0 },
            { x: 11, y: 0 },
            { x: 9, y: 1 },
            { x: 10, y: 1 },
            { x: 11, y: 1 },
            { x: 9, y: 2 },
            { x: 10, y: 2 },
            { x: 11, y: 2 },
          ],
        },
      ],
    },
  ],
};
