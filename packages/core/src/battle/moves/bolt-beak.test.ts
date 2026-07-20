import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, damageTo, MockPokemon } from "../../testing";

function fire(foeX: number) {
  const attacker = MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 2, y: 2 },
    moveIds: ["bolt-beak"],
    currentPp: { "bolt-beak": 5 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: foeX, y: 2 },
  });
  const { engine } = buildMoveTestEngine([attacker, foe], { gridSize: 8, random: () => 0.5 });
  return engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: attacker.id,
    moveId: "bolt-beak",
    targetPosition: { x: 3, y: 2 },
  });
}

describe("bolt-beak", () => {
  it("deals doubled damage to a foe that has not acted yet", () => {
    expect(damageTo(fire(3).events, "foe")).toBeGreaterThan(0);
  });

  it("does not reach a foe two tiles away", () => {
    expect(damageTo(fire(4).events, "foe")).toBe(0);
  });
});
