import { typeChart } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { ActionError } from "../enums/action-error";
import { ActionKind } from "../enums/action-kind";
import { PlayerId } from "../enums/player-id";
import { PokemonType } from "../enums/pokemon-type";
import { TerrainType } from "../enums/terrain-type";
import { MockBattle } from "../testing/mock-battle";
import { BattleEngine } from "./BattleEngine";

function buildEngine(pokemonTypes: PokemonType[], movement = 4, start = { x: 0, y: 0 }) {
  const pokemon = {
    ...MockBattle.player1Fast,
    id: "mover",
    definitionId: "test-pokemon",
    position: start,
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
  const pokemonTypesMap = new Map<string, PokemonType[]>([
    ["test-pokemon", pokemonTypes],
    ["test", [PokemonType.Normal]],
  ]);
  const engine = new BattleEngine(state, new Map(), typeChart, pokemonTypesMap);
  engine.pinActiveForTest("mover");
  return { engine, state };
}

type MockState = ReturnType<typeof buildEngine>["state"];

function fillGrid(state: MockState, terrain: TerrainType): void {
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      MockBattle.setTile(state, x, y, { terrain });
    }
  }
}

function farthestReach(engine: BattleEngine): number {
  return Math.max(
    ...engine.getReachableTilesForPokemon("mover").map((position) => position.x + position.y),
  );
}

function isReachable(engine: BattleEngine, x: number, y: number): boolean {
  return engine
    .getReachableTilesForPokemon("mover")
    .some((position) => position.x === x && position.y === y);
}

function submitMove(engine: BattleEngine, path: { x: number; y: number }[]) {
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.Move,
    pokemonId: "mover",
    path,
  });
}

describe("terrain movement factor (plan 220)", () => {
  it.each([
    [2, 1],
    [3, 2],
    [4, 3],
    [5, 3],
  ])("water scales movement %i to %i tiles", (movement, expected) => {
    const { engine, state } = buildEngine([PokemonType.Normal], movement);
    fillGrid(state, TerrainType.Water);
    expect(farthestReach(engine)).toBe(expected);
  });

  it.each([
    [2, 1],
    [3, 1],
    [4, 2],
    [5, 2],
  ])("swamp scales movement %i to %i tiles", (movement, expected) => {
    const { engine, state } = buildEngine([PokemonType.Normal], movement);
    fillGrid(state, TerrainType.Swamp);
    expect(farthestReach(engine)).toBe(expected);
  });

  it("the penalty is paid once, not per tile", () => {
    const { engine, state } = buildEngine([PokemonType.Normal], 4);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Water });
    MockBattle.setTile(state, 2, 0, { terrain: TerrainType.Water });

    // Budget floor(4 × ¾) = 3: two water tiles then one ground tile.
    expect(
      submitMove(engine, [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ]).success,
    ).toBe(true);
  });

  it("the worst factor of the path wins", () => {
    const { engine, state } = buildEngine([PokemonType.Normal], 4);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Water });
    MockBattle.setTile(state, 2, 0, { terrain: TerrainType.Swamp });

    // Water alone would allow 3 tiles; entering the swamp drops the budget to floor(4 × ½) = 2.
    const result = submitMove(engine, [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.PathTooLong);
  });

  it("leaving a swamp onto firm ground is free", () => {
    const { engine, state } = buildEngine([PokemonType.Normal], 4);
    MockBattle.setTile(state, 0, 0, { terrain: TerrainType.Swamp });
    expect(isReachable(engine, 4, 0)).toBe(true);
  });

  it("a longer detour on firm ground beats a short cut through the swamp", () => {
    const { engine, state } = buildEngine([PokemonType.Normal], 5);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Swamp });

    // Through the swamp the budget is 2, so (3,0) only comes from the 5-step detour along row 1.
    const legalMove = engine
      .getLegalActions(PlayerId.Player1)
      .find(
        (action) =>
          action.kind === ActionKind.Move &&
          action.path.at(-1)?.x === 3 &&
          action.path.at(-1)?.y === 0,
      );
    expect(legalMove?.kind === ActionKind.Move && legalMove.path).toHaveLength(5);
    expect(
      submitMove(engine, [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ]).error,
    ).toBe(ActionError.PathTooLong);
  });

  it("walks around a puddle when it costs no extra step", () => {
    const { engine, state } = buildEngine([PokemonType.Normal], 4);
    MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Swamp });

    const legalMove = engine
      .getLegalActions(PlayerId.Player1)
      .find(
        (action) =>
          action.kind === ActionKind.Move &&
          action.path.at(-1)?.x === 1 &&
          action.path.at(-1)?.y === 1,
      );
    expect(legalMove?.kind === ActionKind.Move && legalMove.path).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
  });

  it("immune types keep their full movement", () => {
    for (const types of [[PokemonType.Poison], [PokemonType.Steel], [PokemonType.Flying]]) {
      const { engine, state } = buildEngine(types, 4);
      fillGrid(state, TerrainType.Swamp);
      expect(farthestReach(engine)).toBe(4);
    }
  });

  it("a mon with no movement stays put", () => {
    const { engine, state } = buildEngine([PokemonType.Normal], 0);
    fillGrid(state, TerrainType.Swamp);
    expect(engine.getReachableTilesForPokemon("mover")).toHaveLength(0);
  });

  it("lists each reachable tile once, and every offered path is accepted", () => {
    const layOut = (state: MockState): void => {
      MockBattle.setTile(state, 1, 0, { terrain: TerrainType.Swamp });
      MockBattle.setTile(state, 0, 2, { terrain: TerrainType.Water });
      MockBattle.setTile(state, 2, 1, { terrain: TerrainType.Sand });
      MockBattle.setTile(state, 3, 3, { terrain: TerrainType.Swamp });
    };
    const { engine, state } = buildEngine([PokemonType.Normal], 6);
    layOut(state);

    const reachable = engine.getReachableTilesForPokemon("mover");
    expect(new Set(reachable.map((p) => `${p.x},${p.y}`)).size).toBe(reachable.length);

    const movePaths = engine
      .getLegalActions(PlayerId.Player1)
      .flatMap((action) => (action.kind === ActionKind.Move ? [action.path] : []));
    expect(movePaths.length).toBe(reachable.length);
    for (const path of movePaths) {
      const fresh = buildEngine([PokemonType.Normal], 6);
      layOut(fresh.state);
      expect(submitMove(fresh.engine, path).success).toBe(true);
    }
  });
});
