import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("triple-axel", () => {
  it("lands all 3 hits when all accuracy checks succeed", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["triple-axel"],
      currentPp: { "triple-axel": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "triple-axel",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const damageEvents = result.events.filter(
      (e): e is Extract<typeof e, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt && e.targetId === defender.id,
    );
    expect(damageEvents).toHaveLength(3);
    vi.restoreAllMocks();
  });

  it("deals escalating damage per hit (3rd hit > 2nd hit > 1st hit)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["triple-axel"],
      currentPp: { "triple-axel": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "triple-axel",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const damageEvents = result.events.filter(
      (e): e is Extract<typeof e, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt && e.targetId === defender.id,
    );
    expect(damageEvents).toHaveLength(3);
    expect(damageEvents[2]?.amount).toBeGreaterThan(damageEvents[1]?.amount ?? 0);
    expect(damageEvents[1]?.amount).toBeGreaterThan(damageEvents[0]?.amount ?? 0);
    vi.restoreAllMocks();
  });

  it("stops at 1 hit when the second per-hit accuracy check fails", () => {
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValue(0.95);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["triple-axel"],
      currentPp: { "triple-axel": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "triple-axel",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const damageEvents = result.events.filter(
      (e): e is Extract<typeof e, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt && e.targetId === defender.id,
    );
    expect(damageEvents).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it("deals 0 hits and no damage when the first accuracy check fails", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.95);
    const attackerMaxHp = 100;
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentHp: attackerMaxHp,
      maxHp: attackerMaxHp,
      moveIds: ["triple-axel"],
      currentPp: { "triple-axel": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);
    const defenderHpBefore = state.pokemon.get(defender.id)?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "triple-axel",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.MoveMissed);
    const damageEvents = result.events.filter(
      (e): e is Extract<typeof e, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt,
    );
    expect(damageEvents).toHaveLength(0);
    expect(state.pokemon.get(defender.id)?.currentHp).toBe(defenderHpBefore);
    expect(state.pokemon.get(attacker.id)?.currentHp).toBe(attackerMaxHp);
    vi.restoreAllMocks();
  });

  it("cannot hit a target out of range", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["triple-axel"],
      currentPp: { "triple-axel": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "triple-axel",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(false);
  });
});
