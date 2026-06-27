import { describe, expect, it } from "vitest";
import { EntryHazardKind } from "../enums/entry-hazard-kind";
import { PlayerId } from "../enums/player-id";
import { PokemonType } from "../enums/pokemon-type";
import { TerrainType } from "../enums/terrain-type";
import { Grid } from "../grid/Grid";
import { MockBattle, MockPokemon } from "../testing";
import type { BattleState } from "../types/battle-state";
import { ejectToSpawn } from "./forced-teleport";

const NORMAL_TYPES = [PokemonType.Normal];
const FAR_THREAT = { x: 4, y: 4 };

function gridOf(state: BattleState): Grid {
  return new Grid(state.grid[0]?.length ?? 0, state.grid.length, state.grid);
}

describe("ejectToSpawn", () => {
  it("teleports the mon back to its own free spawn tile", () => {
    const holder = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "holder",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
      spawnPosition: { x: 0, y: 0 },
    });
    const state = MockBattle.stateFrom([holder]);
    const grid = gridOf(state);

    const event = ejectToSpawn(state, grid, holder, NORMAL_TYPES, FAR_THREAT);

    expect(event).not.toBeNull();
    expect(holder.position).toEqual({ x: 0, y: 0 });
    expect(grid.getOccupant({ x: 0, y: 0 })).toBe("holder");
    expect(grid.getOccupant({ x: 3, y: 3 })).toBeNull();
  });

  it("falls back to a teammate's spawn tile when its own is occupied", () => {
    const ally = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "ally",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      spawnPosition: { x: 1, y: 0 },
    });
    const holder = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "holder",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
      spawnPosition: { x: 0, y: 0 },
    });
    const state = MockBattle.stateFrom([holder, ally]);
    const grid = gridOf(state);

    const event = ejectToSpawn(state, grid, holder, NORMAL_TYPES, FAR_THREAT);

    expect(event).not.toBeNull();
    expect(holder.position).toEqual({ x: 1, y: 0 });
  });

  it("returns null and stays put when the only spawn tile is the current one", () => {
    const holder = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "holder",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      spawnPosition: { x: 0, y: 0 },
    });
    const state = MockBattle.stateFrom([holder]);
    const grid = gridOf(state);

    const event = ejectToSpawn(state, grid, holder, NORMAL_TYPES, FAR_THREAT);

    expect(event).toBeNull();
    expect(holder.position).toEqual({ x: 0, y: 0 });
  });

  it("skips a spawn tile sitting on lethal terrain", () => {
    const holder = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "holder",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
      spawnPosition: { x: 0, y: 0 },
    });
    const state = MockBattle.stateFrom([holder]);
    MockBattle.setTile(state, 0, 0, { terrain: TerrainType.Lava });
    const grid = gridOf(state);

    const event = ejectToSpawn(state, grid, holder, NORMAL_TYPES, FAR_THREAT);

    expect(event).toBeNull();
    expect(holder.position).toEqual({ x: 3, y: 3 });
  });

  it("skips a spawn tile carrying an entry hazard", () => {
    const holder = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "holder",
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
      spawnPosition: { x: 0, y: 0 },
    });
    const state = MockBattle.stateFrom([holder]);
    state.entryHazards.push({ kind: EntryHazardKind.Spikes, tile: { x: 0, y: 0 }, layers: 1 });
    const grid = gridOf(state);

    const event = ejectToSpawn(state, grid, holder, NORMAL_TYPES, FAR_THREAT);

    expect(event).toBeNull();
    expect(holder.position).toEqual({ x: 3, y: 3 });
  });
});
