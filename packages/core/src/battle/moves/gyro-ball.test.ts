import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import type { BattleEvent } from "../../types/battle-event";

function damageTo(events: BattleEvent[], targetId: string): number {
  return events
    .filter(
      (e): e is Extract<BattleEvent, { type: typeof BattleEventType.DamageDealt }> =>
        e.type === BattleEventType.DamageDealt,
    )
    .filter((e) => e.targetId === targetId)
    .reduce((sum, e) => sum + e.amount, 0);
}

function fire(defenderX: number, attackerSpeed: number) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["gyro-ball"],
    currentPp: { "gyro-ball": 5 },
    combatStats: { ...MockPokemon.base.combatStats, speed: attackerSpeed },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const defender = MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: defenderX, y: 0 },
    combatStats: { ...MockPokemon.base.combatStats, speed: 150 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  const { engine } = buildMoveTestEngine([attacker, defender], { gridSize: 8, random: () => 0.5 });
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: attacker.id,
    moveId: "gyro-ball",
    targetPosition: { x: defenderX, y: 0 },
  });
}

describe("gyro-ball", () => {
  it("deals damage to an adjacent target", () => {
    expect(damageTo(fire(1, 30).events, "defender")).toBeGreaterThan(0);
  });

  it("does not reach a target out of melee range", () => {
    expect(damageTo(fire(5, 30).events, "defender")).toBe(0);
  });

  it("hits harder the slower the user is relative to the target", () => {
    const slow = damageTo(fire(1, 20).events, "defender");
    const fast = damageTo(fire(1, 150).events, "defender");
    expect(slow).toBeGreaterThan(fast);
  });
});
