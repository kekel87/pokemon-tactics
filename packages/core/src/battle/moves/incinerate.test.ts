import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("incinerate", () => {
  it("burns up the target's berry without anyone gaining its effect", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["incinerate"],
    });
    const defender = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
      heldItemId: HeldItemId.LiechiBerry,
    });
    const { engine, state } = buildItemTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "incinerate",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.ItemBurned);
    expect(state.pokemon.get(defender.id)?.heldItemId).toBeUndefined();
    expect(state.pokemon.get(attacker.id)?.ateBerryThisBattle).toBeUndefined();
  });
});
