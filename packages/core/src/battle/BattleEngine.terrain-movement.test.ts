import { describe, expect, it } from "vitest";
import { ActionError } from "../enums/action-error";
import { ActionKind } from "../enums/action-kind";
import { PlayerId } from "../enums/player-id";
import { PokemonType } from "../enums/pokemon-type";
import { TerrainType } from "../enums/terrain-type";
import { MockBattle } from "../testing/mock-battle";
import { BattleEngine } from "./BattleEngine";

function buildEngine(pokemonTypes: PokemonType[], movement = 4) {
  const pokemon = {
    ...MockBattle.player1Fast,
    id: "mover",
    definitionId: "test-pokemon",
    position: { x: 0, y: 0 },
    derivedStats: { ...MockBattle.player1Fast.derivedStats, movement },
    statusEffects: [],
    statStages: { ...MockBattle.zeroStatStages },
    volatileStatuses: [],
  };
  const dummy = {
    ...MockBattle.player2Slow,
    id: "dummy",
    position: { x: 9, y: 9 },
  };
  const state = MockBattle.stateFrom([pokemon, dummy], 10, 10);
  state.turnOrder = ["mover", "dummy"];
  state.currentTurnIndex = 0;
  const pokemonTypesMap = new Map<string, PokemonType[]>([
    ["test-pokemon", pokemonTypes],
    ["test", [PokemonType.Normal]],
  ]);
  return { engine: new BattleEngine(state, new Map(), {}, pokemonTypesMap), state };
}

describe("BFS terrain movement penalty", () => {
  it("water tile costs +1 movement for non-immune Pokemon", () => {
    const { engine, state } = buildEngine([PokemonType.Normal]);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Water });

    const reachable = engine.getReachableTilesForPokemon("mover");
    // (1,0) is water: costs 2. Can reach it (0+2=2 ≤ 4).
    expect(reachable.some((p) => p.x === 1 && p.y === 0)).toBe(true);
    // (2,0) after (1,0): costs 2+1=3 ≤ 4. Reachable.
    expect(reachable.some((p) => p.x === 2 && p.y === 0)).toBe(true);
    // (4,0) straight: would cost 2+1+1+1=5 > 4. Not reachable via water.
    // But may be reachable via y-axis route (0,1)→(1,1)→(2,1)→(3,1)→(4,1) = 4 steps.
    // The straight-through-water route (1,0)→(4,0) is blocked by cost.
    // Direct via (1,0): cost 2+1+1 = 4 for tile (3,0). (4,0) = 2+1+1+1=5 > 4. Not reachable that way.
    expect(reachable.some((p) => p.x === 4 && p.y === 0)).toBe(false);
  });

  it("water tile costs 0 for Water-type Pokemon", () => {
    const { engine, state } = buildEngine([PokemonType.Water]);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Water });

    const reachable = engine.getReachableTilesForPokemon("mover");
    // Water Pokemon: no penalty. (4,0) reachable.
    expect(reachable.some((p) => p.x === 4 && p.y === 0)).toBe(true);
  });

  it("water tile costs 0 for Flying-type Pokemon", () => {
    const { engine, state } = buildEngine([PokemonType.Normal, PokemonType.Flying]);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Water });
    MockBattle.setTile(state, 2, 0, { terrain: TerrainType.Water });
    MockBattle.setTile(state, 3, 0, { terrain: TerrainType.Water });

    const reachable = engine.getReachableTilesForPokemon("mover");
    expect(reachable.some((p) => p.x === 4 && p.y === 0)).toBe(true);
  });

  it("swamp costs +2 per tile", () => {
    const { engine, state } = buildEngine([PokemonType.Normal]);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Swamp });

    const reachable = engine.getReachableTilesForPokemon("mover");
    // (1,0) swamp: cost 3. Still reachable (3 ≤ 4).
    expect(reachable.some((p) => p.x === 1 && p.y === 0)).toBe(true);
    // (2,0): cost 3+1=4. Reachable.
    expect(reachable.some((p) => p.x === 2 && p.y === 0)).toBe(true);
    // (3,0): cost 3+1+1=5 > 4. Not reachable via swamp.
    expect(reachable.some((p) => p.x === 3 && p.y === 0)).toBe(false);
  });

  it("swamp costs 0 for Poison-type Pokemon", () => {
    const { engine, state } = buildEngine([PokemonType.Poison]);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Swamp });
    MockBattle.setTile(state, 2, 0, { terrain: TerrainType.Swamp });

    const reachable = engine.getReachableTilesForPokemon("mover");
    expect(reachable.some((p) => p.x === 4 && p.y === 0)).toBe(true);
  });

  it("path too long through water is rejected", () => {
    const { engine, state } = buildEngine([PokemonType.Normal]);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Water });

    // Path (1,0)→(2,0)→(3,0)→(4,0): cost = 2+1+1+1 = 5 > 4 → PathTooLong
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
      ],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.PathTooLong);
  });

  it("valid path through water within budget is accepted", () => {
    const { engine, state } = buildEngine([PokemonType.Normal]);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Water });

    // Path (1,0)→(2,0)→(3,0): cost = 2+1+1 = 4 ≤ 4 → ok
    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.Move,
      pokemonId: "mover",
      path: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
    });
    expect(result.success).toBe(true);
  });
});
