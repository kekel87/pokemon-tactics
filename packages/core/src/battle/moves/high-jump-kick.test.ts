import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("high-jump-kick", () => {
  it("deals damage to an adjacent target when the move connects", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["high-jump-kick"],
      currentPp: { "high-jump-kick": 10 },
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
    const hpBefore = state.pokemon.get(defender.id)?.currentHp ?? 0;
    const attackerHpBefore = state.pokemon.get(attacker.id)?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "high-jump-kick",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(defender.id)?.currentHp).toBeLessThan(hpBefore);
    expect(state.pokemon.get(attacker.id)?.currentHp).toBe(attackerHpBefore);
    vi.restoreAllMocks();
  });

  it("inflicts crash damage equal to floor(maxHp × 0.5) on the user when the move misses", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.95);
    const attackerMaxHp = 100;
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentHp: attackerMaxHp,
      maxHp: attackerMaxHp,
      moveIds: ["high-jump-kick"],
      currentPp: { "high-jump-kick": 10 },
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

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "high-jump-kick",
      targetPosition: { x: 1, y: 0 },
    });

    const expectedCrash = Math.floor(attackerMaxHp * 0.5);
    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.MoveMissed);
    const crashEvent = result.events.find(
      (e): e is Extract<typeof e, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt && e.targetId === attacker.id && e.recoil === true,
    );
    expect(crashEvent).toBeDefined();
    expect(crashEvent?.amount).toBe(expectedCrash);
    expect(state.pokemon.get(attacker.id)?.currentHp).toBe(attackerMaxHp - expectedCrash);
    vi.restoreAllMocks();
  });

  it("inflicts crash damage on the user when the target is immune (Ghost-type)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attackerMaxHp = 100;
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      currentHp: attackerMaxHp,
      maxHp: attackerMaxHp,
      moveIds: ["high-jump-kick"],
      currentPp: { "high-jump-kick": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ghostTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "ghost-target",
      definitionId: "gastly",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, ghostTarget]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "high-jump-kick",
      targetPosition: { x: 1, y: 0 },
    });

    const expectedCrash = Math.floor(attackerMaxHp * 0.5);
    expect(result.success).toBe(true);
    const crashEvent = result.events.find(
      (e): e is Extract<typeof e, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt && e.targetId === attacker.id && e.recoil === true,
    );
    expect(crashEvent).toBeDefined();
    expect(crashEvent?.amount).toBe(expectedCrash);
    expect(state.pokemon.get(attacker.id)?.currentHp).toBe(attackerMaxHp - expectedCrash);
    expect(state.pokemon.get(ghostTarget.id)?.currentHp).toBe(500);
    vi.restoreAllMocks();
  });

  it("cannot hit a target out of range", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["high-jump-kick"],
      currentPp: { "high-jump-kick": 10 },
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
      moveId: "high-jump-kick",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(false);
  });
});
