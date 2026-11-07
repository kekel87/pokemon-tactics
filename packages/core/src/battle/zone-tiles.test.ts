import { describe, expect, it } from "vitest";
import { PlayerId } from "../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import { FIELD_TERRAIN_RADIUS } from "./field-terrain-system";
import { enumerateZoneTiles } from "./zone-tiles";

describe("enumerateZoneTiles", () => {
  it("returns 25 tiles for an r3 diamond centred in a 10x10 grid", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, { id: "c", position: { x: 5, y: 5 } });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "f",
      playerId: PlayerId.Player2,
      position: { x: 9, y: 9 },
    });
    const { state } = buildMoveTestEngine([caster, foe], { gridSize: 10 });
    const tiles = enumerateZoneTiles(state, { x: 5, y: 5 }, FIELD_TERRAIN_RADIUS);
    expect(tiles.length).toBe(25);
  });

  it("truncates out-of-bounds tiles at a corner", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, { id: "c", position: { x: 0, y: 0 } });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "f",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });
    const { state } = buildMoveTestEngine([caster, foe]);
    const tiles = enumerateZoneTiles(state, { x: 0, y: 0 }, FIELD_TERRAIN_RADIUS);
    expect(tiles.length).toBeLessThan(25);
    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.y).toBeGreaterThanOrEqual(0);
    }
  });
});
