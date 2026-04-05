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

export const pocArena: MapDefinition = {
  id: "poc-arena",
  name: "POC Arena",
  width: 12,
  height: 20,
  tiles: buildFlatTiles(12, 20),
  formats: [
    {
      teamCount: 2,
      maxPokemonPerTeam: 6,
      spawnZones: [
        {
          positions: [
            { x: 2, y: 18 }, { x: 3, y: 18 }, { x: 4, y: 18 }, { x: 5, y: 18 },
            { x: 6, y: 18 }, { x: 7, y: 18 }, { x: 8, y: 18 }, { x: 9, y: 18 },
            { x: 2, y: 19 }, { x: 3, y: 19 }, { x: 4, y: 19 }, { x: 5, y: 19 },
            { x: 6, y: 19 }, { x: 7, y: 19 }, { x: 8, y: 19 }, { x: 9, y: 19 },
          ],
        },
        {
          positions: [
            { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 },
            { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 9, y: 0 },
            { x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 },
            { x: 6, y: 1 }, { x: 7, y: 1 }, { x: 8, y: 1 }, { x: 9, y: 1 },
          ],
        },
      ],
    },
    {
      teamCount: 3,
      maxPokemonPerTeam: 4,
      spawnZones: [
        {
          positions: [
            { x: 4, y: 18 }, { x: 5, y: 18 }, { x: 6, y: 18 }, { x: 7, y: 18 },
            { x: 4, y: 19 }, { x: 5, y: 19 }, { x: 6, y: 19 }, { x: 7, y: 19 },
          ],
        },
        {
          positions: [
            { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 },
            { x: 4, y: 1 }, { x: 5, y: 1 }, { x: 6, y: 1 }, { x: 7, y: 1 },
          ],
        },
        {
          positions: [
            { x: 0, y: 8 }, { x: 0, y: 9 }, { x: 0, y: 10 }, { x: 0, y: 11 },
            { x: 1, y: 8 }, { x: 1, y: 9 }, { x: 1, y: 10 }, { x: 1, y: 11 },
          ],
        },
      ],
    },
    {
      teamCount: 4,
      maxPokemonPerTeam: 3,
      spawnZones: [
        {
          positions: [
            { x: 0, y: 18 }, { x: 1, y: 18 }, { x: 2, y: 18 },
            { x: 0, y: 19 }, { x: 1, y: 19 }, { x: 2, y: 19 },
          ],
        },
        {
          positions: [
            { x: 9, y: 18 }, { x: 10, y: 18 }, { x: 11, y: 18 },
            { x: 9, y: 19 }, { x: 10, y: 19 }, { x: 11, y: 19 },
          ],
        },
        {
          positions: [
            { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
            { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
          ],
        },
        {
          positions: [
            { x: 9, y: 0 }, { x: 10, y: 0 }, { x: 11, y: 0 },
            { x: 9, y: 1 }, { x: 10, y: 1 }, { x: 11, y: 1 },
          ],
        },
      ],
    },
    {
      teamCount: 6,
      maxPokemonPerTeam: 2,
      spawnZones: [
        {
          positions: [
            { x: 0, y: 19 }, { x: 1, y: 19 },
          ],
        },
        {
          positions: [
            { x: 10, y: 19 }, { x: 11, y: 19 },
          ],
        },
        {
          positions: [
            { x: 0, y: 0 }, { x: 1, y: 0 },
          ],
        },
        {
          positions: [
            { x: 10, y: 0 }, { x: 11, y: 0 },
          ],
        },
        {
          positions: [
            { x: 5, y: 0 }, { x: 6, y: 0 },
          ],
        },
        {
          positions: [
            { x: 5, y: 19 }, { x: 6, y: 19 },
          ],
        },
      ],
    },
    {
      teamCount: 12,
      maxPokemonPerTeam: 1,
      spawnZones: [
        { positions: [{ x: 0, y: 19 }] },
        { positions: [{ x: 3, y: 19 }] },
        { positions: [{ x: 8, y: 19 }] },
        { positions: [{ x: 11, y: 19 }] },
        { positions: [{ x: 0, y: 0 }] },
        { positions: [{ x: 3, y: 0 }] },
        { positions: [{ x: 8, y: 0 }] },
        { positions: [{ x: 11, y: 0 }] },
        { positions: [{ x: 0, y: 9 }] },
        { positions: [{ x: 11, y: 9 }] },
        { positions: [{ x: 0, y: 10 }] },
        { positions: [{ x: 11, y: 10 }] },
      ],
    },
  ],
};
