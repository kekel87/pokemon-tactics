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
import { scoreAction } from "./action-scorer";
import { EASY_PROFILE } from "./ai-profiles";

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

function buildEngine(
  attackerOverrides: Partial<PokemonInstance> = {},
  defenderOverrides: Partial<PokemonInstance> = {},
) {
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
    ...attackerOverrides,
  });
  const defender = fresh(MockPokemon.bulbasaur, {
    id: "p2-bulbasaur",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    ...defenderOverrides,
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
  return { engine, moveRegistry };
}

describe("scoreAction", () => {
  it("scores a KO move higher than a non-KO move on the same target", () => {
    const { engine, moveRegistry } = buildEngine({}, { currentHp: 10, maxHp: 105 });
    const state = engine.getGameState(PlayerId.Player1);
    const legalActions = engine.getLegalActions(PlayerId.Player1);

    const useMoveActions = legalActions.filter(
      (a) => a.kind === ActionKind.UseMove && (moveRegistry.get(a.moveId)?.power ?? 0) > 0,
    );

    if (useMoveActions.length === 0) {
      return;
    }

    const scores = useMoveActions.map((action) => ({
      action,
      score: scoreAction(action, state, moveRegistry, engine, EASY_PROFILE),
    }));

    const koScore = scores.find((s) => {
      if (s.action.kind !== ActionKind.UseMove) {
        return false;
      }
      const estimate = engine.estimateDamage("p1-charmander", s.action.moveId, "p2-bulbasaur");
      return estimate && estimate.min >= 10;
    });

    const nonKoScore = scores.find((s) => {
      if (s.action.kind !== ActionKind.UseMove) {
        return false;
      }
      const estimate = engine.estimateDamage("p1-charmander", s.action.moveId, "p2-bulbasaur");
      return estimate && estimate.min < 10;
    });

    if (koScore && nonKoScore) {
      expect(koScore.score).toBeGreaterThan(nonKoScore.score);
    }
  });

  it("scores a super-effective move higher than a neutral move of similar power", () => {
    const { engine, moveRegistry } = buildEngine();
    const state = engine.getGameState(PlayerId.Player1);
    const legalActions = engine.getLegalActions(PlayerId.Player1);

    const useMoveActions = legalActions.filter(
      (a) => a.kind === ActionKind.UseMove && (moveRegistry.get(a.moveId)?.power ?? 0) > 0,
    );

    const scores = useMoveActions.map((action) => ({
      action,
      score: scoreAction(action, state, moveRegistry, engine, EASY_PROFILE),
    }));

    const superEffective = scores.find((s) => {
      if (s.action.kind !== ActionKind.UseMove) {
        return false;
      }
      const estimate = engine.estimateDamage("p1-charmander", s.action.moveId, "p2-bulbasaur");
      return estimate && estimate.effectiveness > 1;
    });

    const neutral = scores.find((s) => {
      if (s.action.kind !== ActionKind.UseMove) {
        return false;
      }
      const estimate = engine.estimateDamage("p1-charmander", s.action.moveId, "p2-bulbasaur");
      return estimate && estimate.effectiveness === 1;
    });

    if (superEffective && neutral) {
      expect(superEffective.score).toBeGreaterThan(neutral.score);
    }
  });

  it("scores EndTurn as 0", () => {
    const { engine, moveRegistry } = buildEngine();
    const state = engine.getGameState(PlayerId.Player1);
    const endTurnAction = engine
      .getLegalActions(PlayerId.Player1)
      .find((a) => a.kind === ActionKind.EndTurn);
    if (!endTurnAction) {
      return;
    }
    expect(scoreAction(endTurnAction, state, moveRegistry, engine, EASY_PROFILE)).toBe(0);
  });

  it("scores movement towards enemy positively", () => {
    const { engine, moveRegistry } = buildEngine(
      { position: { x: 0, y: 0 } },
      { position: { x: 5, y: 5 } },
    );
    const state = engine.getGameState(PlayerId.Player1);
    const moveActions = engine
      .getLegalActions(PlayerId.Player1)
      .filter((a) => a.kind === ActionKind.Move);

    const scores = moveActions.map((action) => ({
      action,
      score: scoreAction(action, state, moveRegistry, engine, EASY_PROFILE),
    }));

    const positive = scores.filter((s) => s.score > 0);
    expect(positive.length).toBeGreaterThan(0);
  });
});
