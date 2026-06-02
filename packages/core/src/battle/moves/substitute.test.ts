import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { SubstituteFailedReason } from "../../types/battle-event";

describe("substitute", () => {
  it("posts substitute at 25% maxHp cost and emits SubstitutePosted", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      maxHp: 100,
      currentHp: 100,
      moveIds: ["substitute"],
      currentPp: { substitute: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, enemy]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "substitute",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.SubstitutePosted)).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.DamageDealt)).toBe(false);

    const after = state.pokemon.get("caster");
    expect(after?.currentHp).toBe(75);
    expect(after?.substituteHp).toBe(25);
  });

  it("fails with InsufficientHp when caster HP is at or below 25%", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      maxHp: 100,
      currentHp: 25,
      moveIds: ["substitute"],
      currentPp: { substitute: 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([caster, enemy]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "substitute",
      targetPosition: { x: 0, y: 0 },
    });

    const failed = result.events.find(
      (e) =>
        e.type === BattleEventType.SubstituteFailed &&
        e.reason === SubstituteFailedReason.InsufficientHp,
    );
    expect(failed).toBeDefined();
    expect(state.pokemon.get("caster")?.substituteHp).toBeUndefined();
  });

  it("fails with AlreadyActive when substitute is already up", () => {
    const caster = MockPokemon.fresh(MockPokemon.base, {
      id: "caster",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      maxHp: 100,
      currentHp: 75,
      substituteHp: 25,
      moveIds: ["substitute"],
      currentPp: { substitute: 9 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const enemy = MockPokemon.fresh(MockPokemon.base, {
      id: "enemy",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([caster, enemy]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "substitute",
      targetPosition: { x: 0, y: 0 },
    });

    const failed = result.events.find(
      (e) =>
        e.type === BattleEventType.SubstituteFailed &&
        e.reason === SubstituteFailedReason.AlreadyActive,
    );
    expect(failed).toBeDefined();
  });
});
