import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function setup() {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["role-play"],
    currentPp: { "role-play": 5 },
    abilityId: "torrent",
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    abilityId: "blaze",
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  return buildMoveTestEngine([caster, foe]);
}

describe("role-play", () => {
  it("copies the target's ability onto the caster", () => {
    const { engine, state } = setup();

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "role-play",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(state.pokemon.get("caster")?.abilityIdOverride).toBe("blaze");
    expect(state.pokemon.get("foe")?.abilityIdOverride).toBeUndefined();
  });
});
