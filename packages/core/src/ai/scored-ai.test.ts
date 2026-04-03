import { loadData, typeChart } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { BattleEngine } from "../battle/BattleEngine";
import { PlayerId } from "../enums/player-id";
import type { PokemonType } from "../enums/pokemon-type";
import { MockBattle } from "../testing/mock-battle";
import { MockPokemon } from "../testing/mock-pokemon";
import type { AiProfile } from "../types/ai-profile";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import { createPrng } from "../utils/prng";
import { EASY_PROFILE } from "./ai-profiles";
import { pickScoredAction } from "./scored-ai";

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

describe("pickScoredAction", () => {
  it("with randomWeight=0, always picks the best-scored action", () => {
    const { engine, moveRegistry } = buildEngine();
    const deterministicProfile: AiProfile = { ...EASY_PROFILE, randomWeight: 0, topN: 1 };

    const legalActions = engine.getLegalActions(PlayerId.Player1);
    const state = engine.getGameState(PlayerId.Player1);

    const result1 = pickScoredAction(
      legalActions,
      state,
      moveRegistry,
      engine,
      deterministicProfile,
      createPrng(1),
    );
    const result2 = pickScoredAction(
      legalActions,
      state,
      moveRegistry,
      engine,
      deterministicProfile,
      createPrng(99),
    );

    expect(result1).toEqual(result2);
  });

  it("with randomWeight=1, can pick different actions with different seeds", () => {
    const { engine, moveRegistry } = buildEngine();
    const randomProfile: AiProfile = { ...EASY_PROFILE, randomWeight: 1, topN: 10 };

    const legalActions = engine.getLegalActions(PlayerId.Player1);
    const state = engine.getGameState(PlayerId.Player1);

    const results = new Set<string>();
    for (let seed = 0; seed < 50; seed++) {
      const action = pickScoredAction(
        legalActions,
        state,
        moveRegistry,
        engine,
        randomProfile,
        createPrng(seed),
      );
      results.add(JSON.stringify(action));
    }

    expect(results.size).toBeGreaterThan(1);
  });

  it("always returns an action contained in legalActions", () => {
    const { engine, moveRegistry, random } = buildEngine();
    const legalActions = engine.getLegalActions(PlayerId.Player1);
    const state = engine.getGameState(PlayerId.Player1);
    const action = pickScoredAction(
      legalActions,
      state,
      moveRegistry,
      engine,
      EASY_PROFILE,
      random,
    );
    expect(legalActions).toContainEqual(action);
  });

  it("throws on empty actions", () => {
    const { engine, moveRegistry, random } = buildEngine();
    const state = engine.getGameState(PlayerId.Player1);
    expect(() => pickScoredAction([], state, moveRegistry, engine, EASY_PROFILE, random)).toThrow(
      "No legal actions",
    );
  });
});
