import { describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("freeze-dry", () => {
  it("deals damage to a target within range", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["freeze-dry"],
      currentPp: { "freeze-dry": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);
    const hpBefore = state.pokemon.get(defender.id)?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "freeze-dry",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(defender.id)?.currentHp).toBeLessThan(hpBefore);
  });

  it("cannot hit a target beyond max range of 4", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["freeze-dry"],
      currentPp: { "freeze-dry": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 5, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "freeze-dry",
      targetPosition: { x: 5, y: 0 },
    });

    expect(result.success).toBe(false);
  });

  it("is super effective (×2) against a pure Water target (squirtle), overriding the normal ×0.5", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["freeze-dry"],
      currentPp: { "freeze-dry": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const waterTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "water-target",
      definitionId: "squirtle",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      maxHp: 300,
      currentHp: 300,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, waterTarget]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "freeze-dry",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    const damageEvent = result.events.find(
      (e): e is Extract<typeof e, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt && e.targetId === waterTarget.id,
    );
    expect(damageEvent).toBeDefined();
    expect(damageEvent?.effectiveness).toBe(2);
    expect(state.pokemon.get(waterTarget.id)?.currentHp).toBeLessThan(300);
  });

  it("hits Water/Flying (gyarados) at ×4 effectiveness (×2 override on Water × ×2 Ice vs Flying)", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["freeze-dry"],
      currentPp: { "freeze-dry": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const waterFlyingTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "water-flying-target",
      definitionId: "gyarados",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      maxHp: 500,
      currentHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, waterFlyingTarget]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "freeze-dry",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    const damageEvent = result.events.find(
      (e): e is Extract<typeof e, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt && e.targetId === waterFlyingTarget.id,
    );
    expect(damageEvent).toBeDefined();
    expect(damageEvent?.effectiveness).toBe(4);
  });

  it("hits Water/Ice (lapras) at ×1 effectiveness (×2 override on Water × ×0.5 Ice vs Ice)", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["freeze-dry"],
      currentPp: { "freeze-dry": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const waterIceTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "water-ice-target",
      definitionId: "lapras",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      maxHp: 400,
      currentHp: 400,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, waterIceTarget]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "freeze-dry",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.success).toBe(true);
    const damageEvent = result.events.find(
      (e): e is Extract<typeof e, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt && e.targetId === waterIceTarget.id,
    );
    expect(damageEvent).toBeDefined();
    expect(damageEvent?.effectiveness).toBe(1);
  });

  it("applies frozen status when proc triggers (10% chance)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["freeze-dry"],
      currentPp: { "freeze-dry": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "freeze-dry",
      targetPosition: { x: 2, y: 0 },
    });

    expect(state.pokemon.get(defender.id)?.statusEffects).toContainEqual(
      expect.objectContaining({ type: StatusType.Frozen }),
    );
    vi.restoreAllMocks();
  });

  it("does not apply frozen status when proc does not trigger", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["freeze-dry"],
      currentPp: { "freeze-dry": 20 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "freeze-dry",
      targetPosition: { x: 2, y: 0 },
    });

    expect(state.pokemon.get(defender.id)?.statusEffects).toHaveLength(0);
    vi.restoreAllMocks();
  });
});
