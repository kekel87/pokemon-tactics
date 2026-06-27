import { itemHandlers } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { BattleEventType } from "../../enums/battle-event-type";
import { HeldItemId } from "../../enums/held-item-id";
import { MockBattle, MockMove, MockPokemon } from "../../testing";
import type { AfterItemDamageContext, ItemEndTurnContext } from "../../types/held-item-definition";
import type { PokemonInstance } from "../../types/pokemon-instance";

function pinched(item: HeldItemId): PokemonInstance {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "holder",
    heldItemId: item,
    currentHp: 25,
    maxHp: 100,
  });
}

function afterContext(target: PokemonInstance): AfterItemDamageContext {
  return {
    target,
    attacker: MockPokemon.fresh(MockPokemon.base, { id: "attacker" }),
    move: MockMove.fresh(MockMove.physical),
    damageDealt: 5,
    wasAtMaxHp: false,
    isSuperEffective: false,
    isContact: false,
  };
}

function endTurnContext(pokemon: PokemonInstance): ItemEndTurnContext {
  return { pokemon, state: MockBattle.stateFrom([pokemon]), selfTypes: [] };
}

describe("Baie Lansat", () => {
  const handler = itemHandlers.find((h) => h.id === HeldItemId.LansatBerry);

  it("raises the crit stage by 2 in a pinch and is consumed", () => {
    const holder = pinched(HeldItemId.LansatBerry);
    const result = handler?.onAfterDamageReceived?.(afterContext(holder));
    expect(result?.consumeItem).toBe(true);
    expect(holder.critStageBoost).toBe(2);
  });

  it("does nothing above the pinch threshold", () => {
    const holder = MockPokemon.fresh(MockPokemon.base, {
      heldItemId: HeldItemId.LansatBerry,
      currentHp: 80,
      maxHp: 100,
    });
    const result = handler?.onAfterDamageReceived?.(afterContext(holder));
    expect(result?.consumeItem).toBe(false);
    expect(holder.critStageBoost).toBeUndefined();
  });

  it("raises the crit stage when force-eaten (Picore/Dégommage)", () => {
    const eater = MockPokemon.fresh(MockPokemon.base, { currentHp: 100, maxHp: 100 });
    handler?.onEaten?.(eater);
    expect(eater.critStageBoost).toBe(2);
  });
});

describe("Baie Frista", () => {
  const handler = itemHandlers.find((h) => h.id === HeldItemId.StarfBerry);

  it("raises one stat by 2 at end of turn in a pinch", () => {
    const holder = pinched(HeldItemId.StarfBerry);
    const events = handler?.onEndTurn?.(endTurnContext(holder)) ?? [];
    const statChange = events.find((e) => e.type === BattleEventType.StatChanged);
    expect(statChange).toBeDefined();
    expect(holder.heldItemId).toBeUndefined();
  });

  it("raises one stat by 2 when force-eaten", () => {
    const eater = MockPokemon.fresh(MockPokemon.base, { currentHp: 40, maxHp: 100 });
    const events = handler?.onEaten?.(eater) ?? [];
    expect(events.some((e) => e.type === BattleEventType.StatChanged)).toBe(true);
  });
});
