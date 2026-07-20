import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, damageTo, MockPokemon } from "../../testing";

function fire(timesHit: number) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["rage-fist"],
    currentPp: { "rage-fist": 10 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
    timesHit,
  });
  const defender = MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    currentHp: 500,
    maxHp: 500,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  const { engine } = buildMoveTestEngine([attacker, defender], { random: () => 0.5 });
  return damageTo(
    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "rage-fist",
      targetPosition: { x: 1, y: 0 },
    }).events,
    "defender",
  );
}

describe("rage-fist", () => {
  it("deals damage to an adjacent target", () => {
    expect(fire(0)).toBeGreaterThan(0);
  });

  it("does not reach a target out of range", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["rage-fist"],
      currentPp: { "rage-fist": 10 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
    });
    const defender = MockPokemon.fresh(MockPokemon.base, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 10 },
    });
    const { engine } = buildMoveTestEngine([attacker, defender], { random: () => 0.5 });

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "rage-fist",
      targetPosition: { x: 2, y: 0 },
    });

    expect(damageTo(result.events, "defender")).toBe(0);
  });

  it("deals more damage after taking one hit (timesHit 1 > timesHit 0)", () => {
    const base = fire(0);
    const afterOneHit = fire(1);
    expect(afterOneHit).toBeGreaterThan(base);
  });

  it("scales proportionally: timesHit 2 deals roughly 3x timesHit 0 (power 150 vs 50)", () => {
    const base = fire(0);
    const two = fire(2);
    const ratio = two / base;
    expect(ratio).toBeGreaterThanOrEqual(2.5);
    expect(ratio).toBeLessThanOrEqual(3.5);
  });

  it("caps at timesHit 6 — timesHit 10 does not exceed timesHit 6 damage", () => {
    const cap = fire(6);
    const beyond = fire(10);
    expect(beyond).toBe(cap);
  });
});
