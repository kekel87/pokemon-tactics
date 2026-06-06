import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

describe("beat-up", () => {
  it("deals damage to an adjacent target", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["beat-up"],
      currentPp: { "beat-up": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, foe], { random: () => 0.5 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "beat-up",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.events.map((e) => e.type)).toContain(BattleEventType.DamageDealt);
  });

  it("does not reach a target out of range", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["beat-up"],
      currentPp: { "beat-up": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, foe], { random: () => 0.5 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "beat-up",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.events.map((e) => e.type)).not.toContain(BattleEventType.DamageDealt);
  });

  it("hits once per healthy team member and emits MultiHitComplete", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["beat-up"],
      currentPp: { "beat-up": 10 },
      baseStats: { hp: 100, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const ally1 = MockPokemon.fresh(MockPokemon.base, {
      id: "ally1",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 1 },
      baseStats: { hp: 100, attack: 60, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
    });
    const ally2 = MockPokemon.fresh(MockPokemon.base, {
      id: "ally2",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 2 },
      baseStats: { hp: 100, attack: 70, defense: 50, spAttack: 50, spDefense: 50, speed: 50 },
      derivedStats: { movement: 3, jump: 1, initiative: 80 },
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, ally1, ally2, foe], {
      gridSize: 6,
      random: () => 0.5,
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "beat-up",
      targetPosition: { x: 1, y: 0 },
    });

    const damageEvents = result.events.filter((e) => e.type === BattleEventType.DamageDealt);
    expect(damageEvents).toHaveLength(3);
    const multiHit = result.events.find(
      (e): e is Extract<typeof e, { type: typeof BattleEventType.MultiHitComplete }> =>
        e.type === BattleEventType.MultiHitComplete,
    );
    expect(multiHit).toBeDefined();
    expect(multiHit?.totalHits).toBe(3);
  });

  it("excludes an ally with a major status from the hit count", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["beat-up"],
      currentPp: { "beat-up": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const statusedAlly = MockPokemon.fresh(MockPokemon.base, {
      id: "statused-ally",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 1 },
      derivedStats: { movement: 3, jump: 1, initiative: 90 },
      statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
    });
    const foe = MockPokemon.fresh(MockPokemon.base, {
      id: "foe",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      currentHp: 500,
      maxHp: 500,
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, statusedAlly, foe], {
      gridSize: 6,
      random: () => 0.5,
    });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "beat-up",
      targetPosition: { x: 1, y: 0 },
    });

    const damageEvents = result.events.filter((e) => e.type === BattleEventType.DamageDealt);
    expect(damageEvents).toHaveLength(1);
  });
});
