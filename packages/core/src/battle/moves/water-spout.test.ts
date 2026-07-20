import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, damageTo, MockPokemon } from "../../testing";

function fire(foeX: number, attackerHp: number) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 2, y: 2 },
    moveIds: ["water-spout"],
    currentPp: { "water-spout": 5 },
    currentHp: attackerHp,
    maxHp: 100,
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: foeX, y: 2 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  const { engine } = buildMoveTestEngine([attacker, foe], { gridSize: 8, random: () => 0.5 });
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: attacker.id,
    moveId: "water-spout",
    targetPosition: { x: 3, y: 2 },
  });
}

describe("water-spout", () => {
  it("deals damage to a foe in the cone", () => {
    expect(damageTo(fire(3, 100).events, "foe")).toBeGreaterThan(0);
  });

  it("does not hit a foe outside the cone", () => {
    expect(damageTo(fire(1, 100).events, "foe")).toBe(0);
  });

  it("hits harder at full HP than at low HP", () => {
    const full = damageTo(fire(3, 100).events, "foe");
    const low = damageTo(fire(3, 20).events, "foe");
    expect(full).toBeGreaterThan(low);
  });
});
