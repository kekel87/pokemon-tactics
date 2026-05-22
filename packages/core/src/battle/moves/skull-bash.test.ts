import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatName } from "../../enums/stat-name";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("skull-bash", () => {
  it("T1 charge raises caster Defense by 1 stage", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["skull-bash"],
      currentPp: { "skull-bash": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "skull-bash",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.MoveCharging);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.StatChanged);

    const casterState = state.pokemon.get(attacker.id);
    expect(casterState?.statStages[StatName.Defense]).toBe(1);
    expect(casterState?.chargingMove?.moveId).toBe("skull-bash");
    expect(casterState?.lockedMoveId).toBe("skull-bash");
  });

  it("T2 fires damage when caster is already charging", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["skull-bash"],
      currentPp: { "skull-bash": 9 },
      chargingMove: { moveId: "skull-bash", targetPosition: { x: 0, y: 0 } },
      lockedMoveId: "skull-bash",
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "skull-bash",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
    const casterAfter = state.pokemon.get(attacker.id);
    expect(casterAfter?.chargingMove).toBeUndefined();
    expect(casterAfter?.lockedMoveId).toBeUndefined();
  });

  it("Defense boost from T1 charge persists after T2 fires", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["skull-bash"],
      currentPp: { "skull-bash": 9 },
      chargingMove: { moveId: "skull-bash", targetPosition: { x: 0, y: 0 } },
      lockedMoveId: "skull-bash",
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      statStages: { ...MockPokemon.base.statStages, [StatName.Defense]: 1 },
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine, state } = buildMoveTestEngine([attacker, defender]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "skull-bash",
      targetPosition: { x: 1, y: 0 },
    });

    const casterAfter = state.pokemon.get(attacker.id);
    expect(casterAfter?.statStages[StatName.Defense]).toBe(1);
  });
});
