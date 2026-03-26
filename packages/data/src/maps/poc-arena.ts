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
      maxPokemonPerTeam: 6,
      spawnZones: [
        {
          positions: [
            { x: 3, y: 10 },
            { x: 4, y: 10 },
            { x: 5, y: 10 },
            { x: 6, y: 10 },
            { x: 7, y: 10 },
            { x: 8, y: 10 },
            { x: 3, y: 11 },
            { x: 4, y: 11 },
            { x: 5, y: 11 },
            { x: 6, y: 11 },
            { x: 7, y: 11 },
            { x: 8, y: 11 },
          ],
        },
        {
          positions: [
            { x: 3, y: 0 },
            { x: 4, y: 0 },
            { x: 5, y: 0 },
            { x: 6, y: 0 },
            { x: 7, y: 0 },
            { x: 8, y: 0 },
            { x: 3, y: 1 },
            { x: 4, y: 1 },
            { x: 5, y: 1 },
            { x: 6, y: 1 },
            { x: 7, y: 1 },
            { x: 8, y: 1 },
          ],
        },
      ],
    },
  ],
};
