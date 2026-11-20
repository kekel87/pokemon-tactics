import { type Position, TerrainType } from "@pokemon-tactic/core";
import { MockMap } from "@pokemon-tactic/core/testing";
import { describe, expect, it } from "vitest";
import { pickTrainerTile } from "./sandbox-trainers";

const TEAM: readonly Position[] = [
  { x: 2, y: 1 },
  { x: 3, y: 1 },
];

const TEAM_TILES: ReadonlySet<string> = new Set(
  TEAM.map((position) => `${position.x},${position.y}`),
);

describe("pickTrainerTile", () => {
  it("returns null for an empty team", () => {
    expect(pickTrainerTile(MockMap.map6x6, [], TEAM_TILES)).toBeNull();
  });

  it("picks the closest tile on the side opposite to the map centre", () => {
    expect(pickTrainerTile(MockMap.map6x6, TEAM, TEAM_TILES)).toEqual({ x: 2, y: 0 });
  });

  it("prefers a farther tile behind the team to a nearer one on the map-centre side", () => {
    const water = new Map(
      ["0,0", "1,0", "2,0", "3,0", "4,0", "5,0", "1,1", "4,1"].map((key) => [
        key,
        TerrainType.Water,
      ]),
    );
    expect(pickTrainerTile(MockMap.withTerrain(MockMap.map6x6, water), TEAM, TEAM_TILES)).toEqual({
      x: 0,
      y: 1,
    });
  });

  it("skips a tile already taken", () => {
    const taken = new Set([...TEAM_TILES, "2,0"]);
    expect(pickTrainerTile(MockMap.map6x6, TEAM, taken)).toEqual({ x: 3, y: 0 });
  });

  it.each([
    TerrainType.Water,
    TerrainType.DeepWater,
    TerrainType.Magma,
    TerrainType.Lava,
    TerrainType.Ice,
    TerrainType.Swamp,
    TerrainType.Obstacle,
  ])("skips a %s tile", (terrain) => {
    const map = MockMap.withTerrain(MockMap.map6x6, new Map([["2,0", terrain]]));
    expect(pickTrainerTile(map, TEAM, TEAM_TILES)).toEqual({ x: 3, y: 0 });
  });

  it.each([TerrainType.TallGrass, TerrainType.Sand, TerrainType.Snow])(
    "accepts a %s tile",
    (terrain) => {
      const map = MockMap.withTerrain(MockMap.map6x6, new Map([["2,0", terrain]]));
      expect(pickTrainerTile(map, TEAM, TEAM_TILES)).toEqual({ x: 2, y: 0 });
    },
  );

  it("returns null when no tile is standable", () => {
    const everyTile = new Map(
      MockMap.map6x6.tiles
        .flat()
        .map((tile) => [`${tile.position.x},${tile.position.y}`, TerrainType.Water]),
    );
    expect(
      pickTrainerTile(MockMap.withTerrain(MockMap.map6x6, everyTile), TEAM, TEAM_TILES),
    ).toBeNull();
  });
});
