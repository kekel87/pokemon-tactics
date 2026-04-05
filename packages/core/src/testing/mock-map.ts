import { PlayerController } from "../enums/player-controller";
import { PlayerId } from "../enums/player-id";
import { TerrainType } from "../enums/terrain-type";
import type { MapDefinition } from "../types/map-definition";
import type { MapFormat } from "../types/map-format";
import type { PlacementTeam } from "../types/placement-team";
import type { TileState } from "../types/tile-state";

function buildFlatTiles(width: number, height: number): TileState[][] {
  const tiles: TileState[][] = [];
  for (let y = 0; y < height; y++) {
    const row: TileState[] = [];
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

export abstract class MockMap {
  static readonly format2v2: MapFormat = {
    teamCount: 2,
    maxPokemonPerTeam: 2,
    spawnZones: [
      {
        positions: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ],
      },
      {
        positions: [
          { x: 4, y: 4 },
          { x: 5, y: 4 },
          { x: 4, y: 5 },
          { x: 5, y: 5 },
        ],
      },
    ],
  };

  static readonly map6x6: MapDefinition = {
    id: "test-map",
    name: "Test Map",
    width: 6,
    height: 6,
    tiles: buildFlatTiles(6, 6),
    formats: [MockMap.format2v2],
  };

  static readonly map8x8: MapDefinition = {
    id: "test-map-8",
    name: "Test Map 8x8",
    width: 8,
    height: 8,
    tiles: buildFlatTiles(8, 8),
    formats: [
      {
        teamCount: 2,
        maxPokemonPerTeam: 2,
        spawnZones: [
          {
            positions: [
              { x: 0, y: 6 },
              { x: 1, y: 6 },
              { x: 0, y: 7 },
              { x: 1, y: 7 },
            ],
          },
          {
            positions: [
              { x: 6, y: 0 },
              { x: 7, y: 0 },
              { x: 6, y: 1 },
              { x: 7, y: 1 },
            ],
          },
        ],
      },
    ],
  };

  static readonly team1: PlacementTeam = {
    playerId: PlayerId.Player1,
    pokemonIds: ["poke-a", "poke-b"],
    controller: PlayerController.Human,
  };

  static readonly team2: PlacementTeam = {
    playerId: PlayerId.Player2,
    pokemonIds: ["poke-c", "poke-d"],
    controller: PlayerController.Human,
  };

  static readonly format4teams: MapFormat = {
    teamCount: 4,
    maxPokemonPerTeam: 1,
    spawnZones: [
      {
        positions: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
      },
      {
        positions: [
          { x: 5, y: 0 },
          { x: 5, y: 1 },
        ],
      },
      {
        positions: [
          { x: 0, y: 5 },
          { x: 1, y: 5 },
        ],
      },
      {
        positions: [
          { x: 5, y: 5 },
          { x: 4, y: 5 },
        ],
      },
    ],
  };

  static readonly team3: PlacementTeam = {
    playerId: PlayerId.Player3,
    pokemonIds: ["poke-e"],
    controller: PlayerController.Ai,
  };

  static readonly team4: PlacementTeam = {
    playerId: PlayerId.Player4,
    pokemonIds: ["poke-f"],
    controller: PlayerController.Ai,
  };

  static readonly gridCenter6x6 = { x: 3, y: 3 };

  static buildFlatTiles(width: number, height: number): TileState[][] {
    return buildFlatTiles(width, height);
  }
}
