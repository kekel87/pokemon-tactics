import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("solar-beam", () => {
  it("T1 charge locks caster on solar-beam without dealing damage", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["solar-beam"],
      currentPp: { "solar-beam": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "solar-beam",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.MoveCharging);
    const casterState = state.pokemon.get(attacker.id);
    expect(casterState?.chargingMove?.moveId).toBe("solar-beam");
    expect(casterState?.lockedMoveId).toBe("solar-beam");
    expect(state.pokemon.get(defender.id)?.currentHp).toBe(MockPokemon.charmander.currentHp);
  });

  it("T2 fires line damage when caster is already charging", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["solar-beam"],
      currentPp: { "solar-beam": 9 },
      chargingMove: { moveId: "solar-beam", targetPosition: { x: 0, y: 0 } },
      lockedMoveId: "solar-beam",
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      currentHp: 9999,
      maxHp: 9999,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "solar-beam",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    const defenderAfter = state.pokemon.get(defender.id);
    expect(defenderAfter?.currentHp).toBeLessThan(9999);
    const casterAfter = state.pokemon.get(attacker.id);
    expect(casterAfter?.chargingMove).toBeUndefined();
    expect(casterAfter?.lockedMoveId).toBeUndefined();
  });

  it("T2 hits multiple targets along the line", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["solar-beam"],
      currentPp: { "solar-beam": 9 },
      chargingMove: { moveId: "solar-beam", targetPosition: { x: 0, y: 0 } },
      lockedMoveId: "solar-beam",
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe1 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      currentHp: 9999,
      maxHp: 9999,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const foe2 = MockPokemon.fresh(MockPokemon.base, {
      id: "foe-2",
      playerId: PlayerId.Player2,
      position: { x: 3, y: 0 },
      currentHp: 9999,
      maxHp: 9999,
      derivedStats: { movement: 3, jump: 1, initiative: 9 },
    });
    const { engine } = buildMoveTestEngine([attacker, foe1, foe2]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "solar-beam",
      targetPosition: { x: 5, y: 0 },
    });

    expect(result.success).toBe(true);
    const damageEvents = result.events.filter((e) => e.type === BattleEventType.DamageDealt);
    expect(damageEvents).toHaveLength(2);
  });
});
