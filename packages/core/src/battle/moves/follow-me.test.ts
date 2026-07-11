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
    moveIds: ["follow-me"],
    currentPp: { "follow-me": 5 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 2, y: 0 },
    orientation: Direction.South,
  });
  const farFoe = MockPokemon.fresh(MockPokemon.base, {
    id: "farFoe",
    playerId: PlayerId.Player2,
    position: { x: 5, y: 5 },
    orientation: Direction.South,
  });
  return buildMoveTestEngine([caster, foe, farFoe], { gridSize: 8 });
}

describe("follow-me", () => {
  it("turns enemies in range to face the caster", () => {
    const { engine, state } = setup();

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "follow-me",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.DrewAttention);
    expect(state.pokemon.get("foe")?.orientation).toBe(Direction.West);
  });

  it("leaves enemies out of range untouched", () => {
    const { engine, state } = setup();

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "follow-me",
      targetPosition: { x: 0, y: 0 },
    });

    expect(state.pokemon.get("farFoe")?.orientation).toBe(Direction.South);
  });
});
