import { describe, expect, it, vi } from "vitest";
import { ActionError } from "../../enums/action-error";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("dream-eater", () => {
  it("fails with MoveFailed when target is awake", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["dream-eater"],
      currentPp: { "dream-eater": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const awakeTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "awake",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 200,
      maxHp: 200,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, awakeTarget]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "dream-eater",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.MoveFailed);
    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get(awakeTarget.id)?.currentHp).toBe(200);
  });

  it("deals damage and drains when target is asleep", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["dream-eater"],
      currentPp: { "dream-eater": 15 },
      currentHp: 50,
      maxHp: 300,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const asleepTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "asleep",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 400,
      maxHp: 400,
      statusEffects: [{ type: StatusType.Asleep, remainingTurns: 3 }],
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, asleepTarget]);
    const attackerHpBefore = state.pokemon.get(attacker.id)?.currentHp ?? 0;
    const targetHpBefore = state.pokemon.get(asleepTarget.id)?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "dream-eater",
      targetPosition: { x: 1, y: 0 },
    });

    vi.restoreAllMocks();

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.MoveFailed);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.HpRestored);
    expect(state.pokemon.get(asleepTarget.id)?.currentHp).toBeLessThan(targetHpBefore);
    expect(state.pokemon.get(attacker.id)?.currentHp).toBeGreaterThan(attackerHpBefore);
  });

  it("cannot reach a target beyond range 3", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["dream-eater"],
      currentPp: { "dream-eater": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const farTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "far",
      playerId: PlayerId.Player2,
      position: { x: 4, y: 0 },
      statusEffects: [{ type: StatusType.Asleep, remainingTurns: 3 }],
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, farTarget]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "dream-eater",
      targetPosition: { x: 4, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.InvalidTarget);
  });

  it("does not deal damage if target is awake (no overshoot)", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["dream-eater"],
      currentPp: { "dream-eater": 15 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const awakeTarget = MockPokemon.fresh(MockPokemon.base, {
      id: "awake",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, awakeTarget]);
    const hpBefore = state.pokemon.get(awakeTarget.id)?.currentHp ?? 0;

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "dream-eater",
      targetPosition: { x: 2, y: 0 },
    });

    expect(state.pokemon.get(awakeTarget.id)?.currentHp).toBe(hpBefore);
  });
});
