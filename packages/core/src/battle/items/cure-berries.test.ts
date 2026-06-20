import { itemHandlers } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { BattleEventType } from "../../enums/battle-event-type";
import { HeldItemId } from "../../enums/held-item-id";
import { StatusType } from "../../enums/status-type";
import { MockBattle, MockPokemon } from "../../testing";
import type { ItemEndTurnContext } from "../../types/held-item-definition";
import type { PokemonInstance } from "../../types/pokemon-instance";

function endTurnContext(pokemon: PokemonInstance): ItemEndTurnContext {
  return { pokemon, state: MockBattle.stateFrom([pokemon]), selfTypes: [] };
}

function holder(item: HeldItemId, overrides: Partial<PokemonInstance>): PokemonInstance {
  return MockPokemon.fresh(MockPokemon.base, { id: "holder", heldItemId: item, ...overrides });
}

const MAJOR_CURE_BERRIES: ReadonlyArray<{ item: HeldItemId; status: StatusType }> = [
  { item: HeldItemId.CheriBerry, status: StatusType.Paralyzed },
  { item: HeldItemId.ChestoBerry, status: StatusType.Asleep },
  { item: HeldItemId.PechaBerry, status: StatusType.Poisoned },
  { item: HeldItemId.PechaBerry, status: StatusType.BadlyPoisoned },
  { item: HeldItemId.RawstBerry, status: StatusType.Burned },
  { item: HeldItemId.AspearBerry, status: StatusType.Frozen },
];

describe("Cure berries — major status", () => {
  for (const { item, status } of MAJOR_CURE_BERRIES) {
    const handler = itemHandlers.find((h) => h.id === item);

    it(`Given ${item}, When the turn ends with ${status}, Then the status is cured and the berry is cleared`, () => {
      const pokemon = holder(item, {
        statusEffects: [{ type: status, remainingTurns: null }],
      });
      const events = handler?.onEndTurn?.(endTurnContext(pokemon)) ?? [];
      expect(pokemon.statusEffects).toHaveLength(0);
      expect(pokemon.heldItemId).toBeUndefined();
      expect(events.some((e) => e.type === BattleEventType.StatusRemoved)).toBe(true);
    });

    it(`Given ${item}, When the turn ends with no status, Then the berry is retained`, () => {
      const pokemon = holder(item, { statusEffects: [] });
      expect(handler?.onEndTurn?.(endTurnContext(pokemon))).toHaveLength(0);
      expect(pokemon.heldItemId).toBe(item);
    });
  }
});

describe("Cure berries — confusion and Lum", () => {
  it("Given Persim Berry, When the turn ends while confused, Then confusion is cured", () => {
    const handler = itemHandlers.find((h) => h.id === HeldItemId.PersimBerry);
    const pokemon = holder(HeldItemId.PersimBerry, {
      volatileStatuses: [{ type: StatusType.Confused, remainingTurns: 3 }],
    });
    handler?.onEndTurn?.(endTurnContext(pokemon));
    expect(pokemon.volatileStatuses).toHaveLength(0);
    expect(pokemon.heldItemId).toBeUndefined();
  });

  it("Given Lum Berry, When the turn ends burned and confused, Then both are cured", () => {
    const handler = itemHandlers.find((h) => h.id === HeldItemId.LumBerry);
    const pokemon = holder(HeldItemId.LumBerry, {
      statusEffects: [{ type: StatusType.Burned, remainingTurns: null }],
      volatileStatuses: [{ type: StatusType.Confused, remainingTurns: 2 }],
    });
    handler?.onEndTurn?.(endTurnContext(pokemon));
    expect(pokemon.statusEffects).toHaveLength(0);
    expect(pokemon.volatileStatuses).toHaveLength(0);
    expect(pokemon.heldItemId).toBeUndefined();
  });

  it("Given Rawst Berry, When the turn ends paralyzed, Then the status is retained", () => {
    const handler = itemHandlers.find((h) => h.id === HeldItemId.RawstBerry);
    const pokemon = holder(HeldItemId.RawstBerry, {
      statusEffects: [{ type: StatusType.Paralyzed, remainingTurns: null }],
    });
    expect(handler?.onEndTurn?.(endTurnContext(pokemon))).toHaveLength(0);
    expect(pokemon.statusEffects).toHaveLength(1);
    expect(pokemon.heldItemId).toBe(HeldItemId.RawstBerry);
  });
});
