import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { ActionError } from "../../enums/action-error";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { MockPokemon, buildMoveTestEngine } from "../../testing";
import type { BattleEvent } from "../../types/battle-event";

describe("kinesis", () => {
  it("lowers target accuracy by 1 stage on hit", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["kinesis"],
      currentPp: { kinesis: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "kinesis",
      targetPosition: { x: 1, y: 0 },
    });

    vi.restoreAllMocks();

    expect(result.success).toBe(true);
    const statEvent = result.events.find(
      (e): e is Extract<BattleEvent, { type: typeof BattleEventType.StatChanged }> =>
        e.type === BattleEventType.StatChanged,
    );
    expect(statEvent?.stat).toBe(StatName.Accuracy);
    expect(statEvent?.stages).toBe(-1);
    expect(statEvent?.targetId).toBe(defender.id);
    expect(state.pokemon.get(defender.id)?.statStages[StatName.Accuracy]).toBe(-1);
  });

  it("does not deal damage", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["kinesis"],
      currentPp: { kinesis: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender]);

    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "kinesis",
      targetPosition: { x: 1, y: 0 },
    });

    vi.restoreAllMocks();

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.DamageDealt);
  });

  it("misses when accuracy roll fails", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["kinesis"],
      currentPp: { kinesis: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    vi.spyOn(Math, "random").mockReturnValue(0.99);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "kinesis",
      targetPosition: { x: 1, y: 0 },
    });

    vi.restoreAllMocks();

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.MoveMissed);
    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.StatChanged);
    expect(state.pokemon.get(defender.id)?.statStages[StatName.Accuracy]).toBe(0);
  });

  it("cannot hit beyond max range", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["kinesis"],
      currentPp: { kinesis: 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "kinesis",
      targetPosition: { x: 5, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.InvalidTarget);
  });
});
