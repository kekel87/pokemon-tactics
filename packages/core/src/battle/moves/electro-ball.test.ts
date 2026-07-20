import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, damageTo, MockPokemon } from "../../testing";

function fire(defenderX: number, attackerSpeed: number) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["electro-ball"],
    currentPp: { "electro-ball": 10 },
    combatStats: { ...MockPokemon.base.combatStats, speed: attackerSpeed },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const defender = MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: defenderX, y: 0 },
    combatStats: { ...MockPokemon.base.combatStats, speed: 50 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  const { engine } = buildMoveTestEngine([attacker, defender], { gridSize: 8, random: () => 0.5 });
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: attacker.id,
    moveId: "electro-ball",
    targetPosition: { x: defenderX, y: 0 },
  });
}

describe("electro-ball", () => {
  it("deals damage to a target in range", () => {
    expect(damageTo(fire(2, 200).events, "defender")).toBeGreaterThan(0);
  });

  it("does not reach a target out of range", () => {
    expect(damageTo(fire(5, 200).events, "defender")).toBe(0);
  });

  it("hits harder the faster the user is relative to the target", () => {
    const fast = damageTo(fire(2, 220).events, "defender");
    const slow = damageTo(fire(2, 30).events, "defender");
    expect(fast).toBeGreaterThan(slow);
  });
});
