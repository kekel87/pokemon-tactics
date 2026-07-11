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
    moveIds: ["rage-powder"],
    currentPp: { "rage-powder": 5 },
  });
  const grassFoe = MockPokemon.fresh(MockPokemon.bulbasaur, {
    id: "grassFoe",
    playerId: PlayerId.Player2,
    position: { x: 2, y: 0 },
    orientation: Direction.South,
  });
  const fireFoe = MockPokemon.fresh(MockPokemon.charmander, {
    id: "fireFoe",
    playerId: PlayerId.Player2,
    position: { x: 0, y: 2 },
    orientation: Direction.South,
  });
  return buildMoveTestEngine([caster, grassFoe, fireFoe]);
}

describe("rage-powder", () => {
  it("does not turn a Grass-type enemy (powder immunity)", () => {
    const { engine, state } = setup();

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "rage-powder",
      targetPosition: { x: 0, y: 0 },
    });

    expect(state.pokemon.get("grassFoe")?.orientation).toBe(Direction.South);
  });

  it("turns a non-powder-immune enemy to face the caster", () => {
    const { engine, state } = setup();

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "caster",
      moveId: "rage-powder",
      targetPosition: { x: 0, y: 0 },
    });

    const drew = result.events.find((event) => event.type === BattleEventType.DrewAttention);
    expect(drew).toBeDefined();
    expect(state.pokemon.get("fireFoe")?.orientation).toBe(Direction.North);
  });
});
