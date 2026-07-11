import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { Direction } from "../../enums/direction";
import { PlayerId } from "../../enums/player-id";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function setup() {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["after-you"],
    currentPp: { "after-you": 5 },
  });
  const ally = MockPokemon.fresh(MockPokemon.base, {
    id: "ally",
    playerId: PlayerId.Player1,
    position: { x: 1, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  const fastFoe = MockPokemon.fresh(MockPokemon.base, {
    id: "fastFoe",
    playerId: PlayerId.Player2,
    position: { x: 3, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 200 },
  });
  return buildMoveTestEngine([caster, ally, fastFoe]);
}

describe("after-you", () => {
  it("promotes the target ally to act right after the caster", () => {
    const { engine, state } = setup();

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "after-you",
      targetPosition: { x: 1, y: 0 },
    });

    const event = result.events.find((e) => e.type === BattleEventType.PromotedToActNext);
    expect(event).toEqual(expect.objectContaining({ casterId: "caster", targetId: "ally" }));

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "caster",
      direction: Direction.South,
    });
    expect(state.activePokemonId).toBe("ally");
  });
});
