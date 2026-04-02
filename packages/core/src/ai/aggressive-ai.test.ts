import { loadData, typeChart } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { BattleEngine } from "../battle/BattleEngine";
import { ActionKind } from "../enums/action-kind";
import { PlayerId } from "../enums/player-id";
import type { PokemonType } from "../enums/pokemon-type";
import { MockBattle } from "../testing/mock-battle";
import { MockPokemon } from "../testing/mock-pokemon";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import { createPrng } from "../utils/prng";
import { pickAggressiveAction } from "./aggressive-ai";

function fresh(base: PokemonInstance, overrides: Partial<PokemonInstance>): PokemonInstance {
  return {
    ...base,
    position: { ...base.position },
    statStages: { ...base.statStages },
    statusEffects: [],
    moveIds: [...base.moveIds],
    currentPp: { ...base.currentPp },
    volatileStatuses: [],
    ...overrides,
  };
}

function buildEngine() {
  const data = loadData();
  const moveRegistry = new Map<string, MoveDefinition>();
  for (const move of data.moves) {
    moveRegistry.set(move.id, move);
  }
  const pokemonTypesMap = new Map<string, PokemonType[]>(data.pokemon.map((p) => [p.id, p.types]));

  const attacker = fresh(MockPokemon.charmander, {
    id: "p1-charmander",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
  });
  const defender = fresh(MockPokemon.bulbasaur, {
    id: "p2-bulbasaur",
    playerId: PlayerId.Player2,
    position: { x: 2, y: 0 },
  });

  const random = createPrng(42);
  const state = MockBattle.stateFrom([attacker, defender], 6, 6);
  const engine = new BattleEngine(
    state,
    moveRegistry,
    typeChart,
    pokemonTypesMap,
    undefined,
    random,
    42,
  );
  return { engine, moveRegistry, random };
}

describe("pickAggressiveAction", () => {
  it("picks a damaging move when one can hit", () => {
    const { engine, moveRegistry, random } = buildEngine();
    const legalActions = engine.getLegalActions(PlayerId.Player1);
    const state = engine.getGameState(PlayerId.Player1);
    const action = pickAggressiveAction(legalActions, state, moveRegistry, random);
    expect(action.kind).toBe(ActionKind.UseMove);
  });

  it("picks a move towards the enemy when no attack can reach", () => {
    const data = loadData();
    const moveRegistry = new Map<string, MoveDefinition>();
    for (const move of data.moves) {
      moveRegistry.set(move.id, move);
    }
    const pokemonTypesMap = new Map<string, PokemonType[]>(
      data.pokemon.map((p) => [p.id, p.types]),
    );

    const attacker = fresh(MockPokemon.charmander, {
      id: "p1-charmander",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const defender = fresh(MockPokemon.bulbasaur, {
      id: "p2-bulbasaur",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 5 },
    });

    const random = createPrng(42);
    const state = MockBattle.stateFrom([attacker, defender], 6, 6);
    const engine = new BattleEngine(
      state,
      moveRegistry,
      typeChart,
      pokemonTypesMap,
      undefined,
      random,
      42,
    );

    const legalActions = engine.getLegalActions(PlayerId.Player1);
    const gameState = engine.getGameState(PlayerId.Player1);

    const hasAttackInRange = legalActions.some(
      (a) => a.kind === ActionKind.UseMove && (moveRegistry.get(a.moveId)?.power ?? 0) > 0,
    );

    if (!hasAttackInRange) {
      const action = pickAggressiveAction(legalActions, gameState, moveRegistry, random);
      expect(action.kind).toBe(ActionKind.Move);
    }
  });

  it("always picks a legal action", () => {
    const { engine, moveRegistry, random } = buildEngine();
    const legalActions = engine.getLegalActions(PlayerId.Player1);
    const state = engine.getGameState(PlayerId.Player1);
    const action = pickAggressiveAction(legalActions, state, moveRegistry, random);
    expect(legalActions).toContainEqual(action);
  });

  it("throws on empty actions", () => {
    const state = MockBattle.stateFrom([]);
    const moveRegistry = new Map<string, MoveDefinition>();
    const random = createPrng(1);
    expect(() => pickAggressiveAction([], state, moveRegistry, random)).toThrow("No legal actions");
  });
});
