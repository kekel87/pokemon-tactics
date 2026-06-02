import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { SemiInvulnerableState } from "../../types/semi-invulnerable-state";
import { createPrng } from "../../utils/prng";

describe("phantom-force", () => {
  it("T1 charge emits MoveCharging, sets Vanished semi-invulnerable state, no damage", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["phantom-force"],
      currentPp: { "phantom-force": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 1 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender], {
      gridSize: 8,
      random: createPrng(0),
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "phantom-force",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.MoveCharging)).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.DamageDealt)).toBe(false);
    expect(result.events.some((e) => e.type === BattleEventType.Teleported)).toBe(false);

    const casterState = state.pokemon.get(attacker.id);
    expect(casterState?.semiInvulnerableState).toBe(SemiInvulnerableState.Vanished);
    expect(casterState?.chargingMove?.moveId).toBe("phantom-force");
    expect(casterState?.lockedMoveId).toBe("phantom-force");
    expect(casterState?.position).toEqual({ x: 0, y: 0 });
    expect(state.pokemon.get(defender.id)?.currentHp).toBe(MockPokemon.charmander.currentHp);
  });

  it("T2 teleports to empty landing tile and deals damage to adjacent foe", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["phantom-force"],
      currentPp: { "phantom-force": 9 },
      chargingMove: { moveId: "phantom-force", targetPosition: { x: 0, y: 0 } },
      lockedMoveId: "phantom-force",
      semiInvulnerableState: SemiInvulnerableState.Vanished,
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 1 },
      currentHp: 9999,
      maxHp: 9999,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender], {
      gridSize: 8,
      random: createPrng(0),
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "phantom-force",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.DamageDealt)).toBe(true);
    expect(result.events.some((e) => e.type === BattleEventType.Teleported)).toBe(true);

    const casterAfter = state.pokemon.get(attacker.id);
    expect(casterAfter?.chargingMove).toBeUndefined();
    expect(casterAfter?.lockedMoveId).toBeUndefined();
    expect(casterAfter?.semiInvulnerableState).toBeUndefined();
    expect(casterAfter?.position).toEqual({ x: 3, y: 0 });
    expect(state.pokemon.get(defender.id)?.currentHp).toBeLessThan(9999);
  });
});
