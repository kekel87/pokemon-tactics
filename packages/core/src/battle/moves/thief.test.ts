import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("thief", () => {
  it("steals the target's item when the user is empty-handed", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["thief"],
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      heldItemId: HeldItemId.Leftovers,
    });
    const { engine, state } = buildItemTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "thief",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.ItemStolen);
    expect(state.pokemon.get(attacker.id)?.heldItemId).toBe(HeldItemId.Leftovers);
    expect(state.pokemon.get(defender.id)?.heldItemId).toBeUndefined();
  });

  it("does not steal when the user already holds an item", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["thief"],
      heldItemId: HeldItemId.ChoiceBand,
    });
    const defender = MockPokemon.fresh(MockPokemon.charmander, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      heldItemId: HeldItemId.Leftovers,
    });
    const { engine, state } = buildItemTestEngine([attacker, defender]);

    engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "thief",
      targetPosition: { x: 1, y: 0 },
    });

    expect(state.pokemon.get(attacker.id)?.heldItemId).toBe(HeldItemId.ChoiceBand);
    expect(state.pokemon.get(defender.id)?.heldItemId).toBe(HeldItemId.Leftovers);
  });
});
