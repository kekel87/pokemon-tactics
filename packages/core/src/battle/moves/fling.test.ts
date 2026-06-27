import { describe, expect, it } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildItemTestEngine, MockPokemon } from "../../testing";

describe("fling", () => {
  it("throws the held item, dealing damage and its fling secondary, then loses it", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["fling"],
      heldItemId: HeldItemId.FlameOrb,
    });
    const defender = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
    });
    const { engine, state } = buildItemTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "fling",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    const types = result.events.map((e) => e.type);
    expect(types).toContain(BattleEventType.DamageDealt);
    expect(types).toContain(BattleEventType.ItemFlung);
    expect(state.pokemon.get(attacker.id)?.heldItemId).toBeUndefined();
    expect(
      state.pokemon.get(defender.id)?.statusEffects.some((s) => s.type === StatusType.Burned),
    ).toBe(true);
  });

  it("cannot be used without a flingable item", () => {
    const attacker = MockPokemon.fresh(MockPokemon.base, {
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      moveIds: ["fling"],
    });
    const defender = MockPokemon.fresh(MockPokemon.squirtle, {
      id: "defender",
      playerId: PlayerId.Player2,
      position: { x: 1, y: 0 },
    });
    const { engine } = buildItemTestEngine([attacker, defender]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: attacker.id,
      moveId: "fling",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(false);
  });
});
