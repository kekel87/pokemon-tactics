import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, damageTo, MockPokemon } from "../../testing";

function fire(defenderX: number, attackerHp: number) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["reversal"],
    currentPp: { reversal: 15 },
    currentHp: attackerHp,
    maxHp: 100,
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const defender = MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: defenderX, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  const { engine } = buildMoveTestEngine([attacker, defender], { gridSize: 8, random: () => 0.5 });
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: attacker.id,
    moveId: "reversal",
    targetPosition: { x: defenderX, y: 0 },
  });
}

describe("reversal", () => {
  it("deals damage to an adjacent target", () => {
    expect(damageTo(fire(1, 100).events, "defender")).toBeGreaterThan(0);
  });

  it("does not reach a target out of melee range", () => {
    expect(damageTo(fire(5, 100).events, "defender")).toBe(0);
  });

  it("hits harder the lower the user's HP", () => {
    const low = damageTo(fire(1, 5).events, "defender");
    const high = damageTo(fire(1, 100).events, "defender");
    expect(low).toBeGreaterThan(high);
  });
});
