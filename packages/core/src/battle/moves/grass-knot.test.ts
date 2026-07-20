import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, damageTo, MockPokemon } from "../../testing";

function fire(defenderX: number, defenderWeight: number) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["grass-knot"],
    currentPp: { "grass-knot": 20 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const defender = MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: defenderX, y: 0 },
    weight: defenderWeight,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  const { engine } = buildMoveTestEngine([attacker, defender], { gridSize: 8, random: () => 0.5 });
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: attacker.id,
    moveId: "grass-knot",
    targetPosition: { x: defenderX, y: 0 },
  });
}

describe("grass-knot", () => {
  it("deals damage to an adjacent target", () => {
    expect(damageTo(fire(1, 100).events, "defender")).toBeGreaterThan(0);
  });

  it("does not reach a target out of range", () => {
    expect(damageTo(fire(3, 100).events, "defender")).toBe(0);
  });

  it("hits a heavy target harder than a light one", () => {
    const light = damageTo(fire(1, 5).events, "defender");
    const heavy = damageTo(fire(1, 250).events, "defender");
    expect(heavy).toBeGreaterThan(light);
  });
});
