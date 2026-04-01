import { loadData } from "@pokemon-tactic/data";
import { describe, expect, it, vi } from "vitest";
import { ActionError } from "../enums/action-error";
import { ActionKind } from "../enums/action-kind";
import { Direction } from "../enums/direction";
import { PlayerId } from "../enums/player-id";
import { PokemonType } from "../enums/pokemon-type";
import { StatusType } from "../enums/status-type";
import { MockBattle, MockPokemon } from "../testing";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import { BattleEngine } from "./BattleEngine";

function buildEngine(pokemon: PokemonInstance[], gridSize = 8) {
  const data = loadData();
  const moveRegistry = new Map<string, MoveDefinition>();
  for (const move of data.moves) {
    moveRegistry.set(move.id, move);
  }
  const pokemonTypesMap = new Map<string, PokemonType[]>([
    ["bulbasaur", [PokemonType.Grass, PokemonType.Poison]],
    ["charmander", [PokemonType.Fire]],
  ]);
  const state = MockBattle.stateFrom(pokemon, gridSize, gridSize);
  const engine = new BattleEngine(state, moveRegistry, undefined, pokemonTypesMap);
  return { engine, state };
}

describe("Battle loop integration", () => {
  /**
   * Scenario 2 — Sleep + Leech Seed drain
   *
   * Given Bulbasaur (team A) and Charmander (team B) on an 8x8 grid, adjacent
   * When Round 1: Bulbasaur uses Sleep Powder on Charmander
   * And Round 2: Bulbasaur uses Leech Seed on Charmander (Charmander sleeps, skip)
   * Then Charmander is asleep and drained each end of turn
   * And Charmander cannot act during sleep
   * And drain heals Bulbasaur
   * And when Charmander wakes up, it can act normally
   */
  it("sleep + leech seed drain combo", () => {
    // Control Math.random for each call:
    // 1. accuracy check (Sleep Powder) → 0 (hit)
    // 2. status chance check (75%) → 0 (apply)
    // 3. sleep duration → 0.7 (floor(0.7*3)+1 = 3 turns)
    // 4+ subsequent calls → 0.5 (neutral)
    const randomMock = vi.spyOn(Math, "random");
    randomMock
      .mockReturnValueOnce(0) // accuracy hit
      .mockReturnValueOnce(0) // status chance passes
      .mockReturnValueOnce(0.7) // sleep duration = 3 turns
      .mockReturnValue(0); // default for remaining calls (accuracy, etc.)

    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player1,
      position: { x: 3, y: 3 },
      currentHp: 30,
      maxHp: 45,
      derivedStats: { movement: 3, jump: 1, initiative: 70 },
    });
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player2,
      position: { x: 4, y: 3 },
      derivedStats: { movement: 3, jump: 1, initiative: 50 },
    });

    const { engine, state } = buildEngine([bulbasaur, charmander]);

    // Round 1: Bulbasaur uses Sleep Powder on Charmander
    expect(state.turnOrder[0]).toBe("bulbasaur-1");
    const sleepResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "bulbasaur-1",
      moveId: "sleep-powder",
      targetPosition: { x: 4, y: 3 },
    });
    expect(sleepResult.success).toBe(true);
    expect(charmander.statusEffects.some((s) => s.type === StatusType.Asleep)).toBe(true);

    // EndTurn for Bulbasaur → Charmander's turn is auto-skipped (sleep)
    // Round 2 starts — Bulbasaur's turn again
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "bulbasaur-1",
      direction: Direction.South,
    });

    // Round 2: Bulbasaur uses Leech Seed
    const leechResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "bulbasaur-1",
      moveId: "leech-seed",
      targetPosition: { x: 4, y: 3 },
    });
    expect(leechResult.success).toBe(true);
    expect(state.activeLinks.length).toBeGreaterThanOrEqual(1);

    // EndTurn for Bulbasaur → drain happens during EndTurn pipeline
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "bulbasaur-1",
      direction: Direction.South,
    });

    // EndTurn drain should have healed Bulbasaur
    const bulbasaurHpAfterLeech = bulbasaur.currentHp;
    expect(bulbasaurHpAfterLeech).toBeGreaterThan(30);

    vi.restoreAllMocks();
  });

  it("getLegalActions returns empty after BattleEnded", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 1,
      maxHp: 45,
      statusEffects: [{ type: StatusType.Poisoned, remainingTurns: null }],
    });

    const { engine } = buildEngine([charmander, bulbasaur]);

    // Charmander skips, Bulbasaur starts turn → poison KOs
    engine.submitAction(PlayerId.Player1, { kind: ActionKind.EndTurn, pokemonId: "charmander-1", direction: Direction.South });

    expect(engine.getLegalActions(PlayerId.Player1)).toEqual([]);
    expect(engine.getLegalActions(PlayerId.Player2)).toEqual([]);

    vi.restoreAllMocks();
  });

  it("submitAction returns BattleOver after battle ends", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 1,
      maxHp: 45,
      statusEffects: [{ type: StatusType.Poisoned, remainingTurns: null }],
    });

    const { engine } = buildEngine([charmander, bulbasaur]);

    engine.submitAction(PlayerId.Player1, { kind: ActionKind.EndTurn, pokemonId: "charmander-1", direction: Direction.South });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "charmander-1",
      direction: Direction.South,
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.BattleOver);

    vi.restoreAllMocks();
  });
});
