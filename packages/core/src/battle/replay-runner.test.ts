import { loadData, typeChart } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { Direction } from "../enums/direction";
import { PlayerId } from "../enums/player-id";
import type { PokemonType } from "../enums/pokemon-type";
import { MockBattle } from "../testing/mock-battle";
import { MockPokemon } from "../testing/mock-pokemon";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import { createPrng } from "../utils/prng";
import { BattleEngine } from "./BattleEngine";
import { runReplay } from "./replay-runner";

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

function buildSeededEngine(seed: number) {
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
    position: { x: 1, y: 0 },
  });

  const state = MockBattle.stateFrom([attacker, defender]);
  const random = createPrng(seed);
  return new BattleEngine(state, moveRegistry, typeChart, pokemonTypesMap, undefined, random, seed);
}

describe("replay-runner", () => {
  it("replaying exported actions produces identical final state", () => {
    const engine1 = buildSeededEngine(42);

    engine1.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "p1-charmander",
      moveId: "ember",
      targetPosition: { x: 1, y: 0 },
    });
    engine1.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "p1-charmander",
      direction: Direction.East,
    });
    engine1.submitAction(PlayerId.Player2, {
      kind: ActionKind.UseMove,
      pokemonId: "p2-bulbasaur",
      moveId: "razor-leaf",
      targetPosition: { x: 0, y: 0 },
    });
    engine1.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "p2-bulbasaur",
      direction: Direction.West,
    });

    const replay = engine1.exportReplay();
    expect(replay.seed).toBe(42);
    expect(replay.actions.length).toBe(4);

    const engine2 = runReplay(replay, (seed) => buildSeededEngine(seed));

    const state1 = engine1.getGameState("");
    const state2 = engine2.getGameState("");

    const p1a = state1.pokemon.get("p1-charmander");
    const p1b = state2.pokemon.get("p1-charmander");
    expect(p1a?.currentHp).toBe(p1b?.currentHp);

    const p2a = state1.pokemon.get("p2-bulbasaur");
    const p2b = state2.pokemon.get("p2-bulbasaur");
    expect(p2a?.currentHp).toBe(p2b?.currentHp);

    expect(state1.roundNumber).toBe(state2.roundNumber);
    expect(state1.currentTurnIndex).toBe(state2.currentTurnIndex);
  });

  it("throws on invalid replay action", () => {
    const badReplay = {
      seed: 42,
      actions: [
        {
          kind: ActionKind.UseMove as const,
          pokemonId: "p1-charmander",
          moveId: "nonexistent-move",
          targetPosition: { x: 1, y: 0 },
        },
      ],
    };

    expect(() => runReplay(badReplay, (seed) => buildSeededEngine(seed))).toThrow("Replay failed");
  });
});
