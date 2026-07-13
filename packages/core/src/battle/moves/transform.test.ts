import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";
import { effectiveMoveIds } from "../effective-move-ids";

function setup() {
  const caster = MockPokemon.fresh(MockPokemon.squirtle, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["transform"],
  });
  const foe = MockPokemon.fresh(MockPokemon.charmander, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    moveIds: ["ember", "scratch", "growl", "smokescreen"],
  });
  return buildMoveTestEngine([caster, foe]);
}

describe("transform", () => {
  it("copies the target's combat stats and moves onto the caster", () => {
    const { engine, state } = setup();

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "transform",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const morphed = state.pokemon.get("caster");
    expect(morphed?.transformState?.definitionId).toBe("charmander");
    expect(morphed?.transformState?.combatStats).toEqual(state.pokemon.get("foe")?.combatStats);
    expect(effectiveMoveIds(morphed as NonNullable<typeof morphed>)).toEqual([
      "ember",
      "scratch",
      "growl",
      "smokescreen",
    ]);
    expect(state.pokemon.get("foe")?.transformState).toBeUndefined();
  });
});
