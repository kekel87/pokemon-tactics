import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function setup() {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["ally-switch"],
    currentPp: { "ally-switch": 5 },
  });
  const ally = MockPokemon.fresh(MockPokemon.base, {
    id: "ally",
    playerId: PlayerId.Player1,
    position: { x: 2, y: 0 },
  });
  return buildMoveTestEngine([caster, ally]);
}

describe("ally-switch", () => {
  it("swaps grid positions with the target ally", () => {
    const { engine, state } = setup();

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "ally-switch",
      targetPosition: { x: 2, y: 0 },
    });

    expect(result.events.map((event) => event.type)).toContain(BattleEventType.AlliesSwapped);
    expect(state.pokemon.get("caster")?.position).toEqual({ x: 2, y: 0 });
    expect(state.pokemon.get("ally")?.position).toEqual({ x: 0, y: 0 });
  });
});
