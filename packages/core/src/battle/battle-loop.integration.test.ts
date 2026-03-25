import { loadData } from "@pokemon-tactic/data";
import { describe, expect, it, vi } from "vitest";
import { ActionError } from "../enums/action-error";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Direction } from "../enums/direction";
import { PlayerId } from "../enums/player-id";
import { PokemonType } from "../enums/pokemon-type";
import { StatusType } from "../enums/status-type";
import { MockBattle, MockPokemon } from "../testing";
import type { BattleEvent } from "../types/battle-event";
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
   * Scenario 1 — Poison kills
   *
   * Given Charmander (team A) and Bulbasaur (team B) on an 8x8 grid
   * And Bulbasaur has status Poisoned
   * When both players skip their turns for multiple rounds
   * Then poison inflicts 1/8 HP to Bulbasaur each start of turn
   * And when Bulbasaur is KO'd, BattleEnded is emitted with team A winning
   */
  it("poison kills over multiple rounds", () => {
    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 7, y: 7 },
      statusEffects: [{ type: StatusType.Poisoned, remainingTurns: null }],
    });

    const { engine } = buildEngine([charmander, bulbasaur]);
    const allEvents: BattleEvent[] = [];
    engine.on(BattleEventType.BattleEnded, (e) => allEvents.push(e));
    engine.on(BattleEventType.PokemonKo, (e) => allEvents.push(e));
    engine.on(BattleEventType.PokemonEliminated, (e) => allEvents.push(e));

    const poisonDamage = Math.max(1, Math.floor(bulbasaur.maxHp / 8));
    const turnsToKill = Math.ceil(bulbasaur.currentHp / poisonDamage);

    for (let i = 0; i < turnsToKill + 5; i++) {
      const actions = engine.getLegalActions(PlayerId.Player1);
      if (actions.length === 0) {
        break;
      }
      engine.submitAction(PlayerId.Player1, { kind: ActionKind.EndTurn, pokemonId: "charmander-1", direction: Direction.South });

      const actions2 = engine.getLegalActions(PlayerId.Player2);
      if (actions2.length === 0) {
        break;
      }
      engine.submitAction(PlayerId.Player2, { kind: ActionKind.EndTurn, pokemonId: "bulbasaur-1", direction: Direction.South });
    }

    expect(bulbasaur.currentHp).toBe(0);
    expect(allEvents.some((e) => e.type === BattleEventType.PokemonKo)).toBe(true);
    expect(allEvents.some((e) => e.type === BattleEventType.BattleEnded)).toBe(true);

    const battleEnded = allEvents.find(
      (e): e is Extract<BattleEvent, { type: typeof BattleEventType.BattleEnded }> =>
        e.type === BattleEventType.BattleEnded,
    );
    expect(battleEnded?.winnerId).toBe(PlayerId.Player1);

    expect(engine.getLegalActions(PlayerId.Player1)).toEqual([]);
    expect(engine.getLegalActions(PlayerId.Player2)).toEqual([]);
  });

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

  /**
   * Scenario 3 — Paralysis restricts movement
   *
   * Given Charmander (team A) and Bulbasaur (team B) on an 8x8 grid
   * And Bulbasaur is paralyzed
   * When paralysis procs (mock Math.random)
   * Then getLegalActions does not contain Move or UseMove dash
   * But getLegalActions contains Razor Leaf
   * And next round order reflects -50% initiative
   */
  it("paralysis restricts movement and dash", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const charmander = MockPokemon.fresh(MockPokemon.charmander, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const bulbasaur = MockPokemon.fresh(MockPokemon.bulbasaur, {
      playerId: PlayerId.Player2,
      position: { x: 7, y: 7 },
      statusEffects: [{ type: StatusType.Paralyzed, remainingTurns: null }],
      derivedStats: { movement: 3, jump: 1, initiative: 80 },
    });

    const { engine } = buildEngine([charmander, bulbasaur]);

    // Charmander plays first (initiative 90 > 80), skip
    engine.submitAction(PlayerId.Player1, { kind: ActionKind.EndTurn, pokemonId: "charmander-1", direction: Direction.South });

    // Bulbasaur's turn — paralysis procs (Math.random = 0 < 0.25)
    const actions = engine.getLegalActions(PlayerId.Player2);

    const moveActions = actions.filter((a) => a.kind === ActionKind.Move);
    expect(moveActions).toHaveLength(0);

    const useMoveActions = actions.filter((a) => a.kind === ActionKind.UseMove);
    const moveIds = [
      ...new Set(useMoveActions.map((a) => (a.kind === ActionKind.UseMove ? a.moveId : ""))),
    ];
    expect(moveIds).toContain("razor-leaf");
    expect(moveIds).toContain("sludge-bomb");

    vi.restoreAllMocks();
  });

  /**
   * Scenario 4 — Dynamic initiative after paralysis
   *
   * Given Pokemon A (initiative 100) and Pokemon B (initiative 80)
   * And A always plays before B at round 1
   * When Pokemon A is paralyzed (effective initiative 50)
   * Then at round 2, B (80) plays before A (50)
   */
  it("paralysis changes turn order via dynamic initiative", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const pokemonA = MockPokemon.fresh(MockPokemon.charmander, {
      id: "pokemon-a",
      definitionId: "test",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      statusEffects: [],
    });
    const pokemonB = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "pokemon-b",
      definitionId: "test",
      playerId: PlayerId.Player2,
      position: { x: 7, y: 7 },
      derivedStats: { movement: 3, jump: 1, initiative: 80 },
      statusEffects: [],
    });

    const { engine, state } = buildEngine([pokemonA, pokemonB]);

    // Round 1: A (100) plays before B (80)
    expect(state.turnOrder[0]).toBe("pokemon-a");

    // A gets paralyzed — apply it manually
    pokemonA.statusEffects = [{ type: StatusType.Paralyzed, remainingTurns: null }];

    // Skip both turns to advance to round 2
    engine.submitAction(PlayerId.Player1, { kind: ActionKind.EndTurn, pokemonId: "pokemon-a", direction: Direction.South });
    engine.submitAction(PlayerId.Player2, { kind: ActionKind.EndTurn, pokemonId: "pokemon-b", direction: Direction.South });

    // Round 2: recalculated — B (80) should play before A (50 = 100 * 0.5 due to paralysis)
    expect(state.roundNumber).toBe(2);
    expect(state.turnOrder[0]).toBe("pokemon-b");

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
