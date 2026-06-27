import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("recycle", () => {
  it("restores the user's last self-consumed item", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["recycle"],
      consumedItemId: HeldItemId.SitrusBerry,
    });
    const { engine, state } = buildItemTestEngine([attacker]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "recycle",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((e) => e.type)).toContain(BattleEventType.ItemRecycled);
    expect(state.pokemon.get(attacker.id)?.heldItemId).toBe(HeldItemId.SitrusBerry);
    expect(state.pokemon.get(attacker.id)?.consumedItemId).toBeUndefined();
  });

  it("fails when nothing has been consumed", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["recycle"],
    });
    const { engine } = buildItemTestEngine([attacker]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "recycle",
      targetPosition: { x: 0, y: 0 },
    });

    expect(result.events.map((e) => e.type)).toContain(BattleEventType.ItemMoveFailed);
  });
});
