import { itemHandlers } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { HeldItemId } from "../../enums/held-item-id";
import type { StatName } from "../../enums/stat-name";
import { StatName as Stat } from "../../enums/stat-name";
import { MockBattle, MockMove, MockPokemon } from "../../testing";
import type { AfterItemDamageContext, ItemEndTurnContext } from "../../types/held-item-definition";
import type { PokemonInstance } from "../../types/pokemon-instance";

const PINCH_STAT_BERRIES: ReadonlyArray<{ item: HeldItemId; stat: StatName }> = [
  { item: HeldItemId.LiechiBerry, stat: Stat.Attack },
  { item: HeldItemId.GanlonBerry, stat: Stat.Defense },
  { item: HeldItemId.PetayaBerry, stat: Stat.SpAttack },
  { item: HeldItemId.ApicotBerry, stat: Stat.SpDefense },
  { item: HeldItemId.SalacBerry, stat: Stat.Speed },
];

function pinched(item: HeldItemId): PokemonInstance {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "holder",
    heldItemId: item,
    currentHp: 25,
    maxHp: 100,
  });
}

function healthy(item: HeldItemId): PokemonInstance {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "holder",
    heldItemId: item,
    currentHp: 60,
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

describe("Pinch stat berries", () => {
  for (const { item, stat } of PINCH_STAT_BERRIES) {
    const handler = itemHandlers.find((h) => h.id === item);

    it(`Given ${item} at 25% HP, When damage is received, Then ${stat} rises by one stage and the berry is consumed`, () => {
      const target = pinched(item);
      const result = handler?.onAfterDamageReceived?.(afterContext(target));
      expect(target.statStages[stat]).toBe(1);
      expect(result?.consumeItem).toBe(true);
    });

    it(`Given ${item} at 60% HP, When damage is received, Then no boost and the berry is retained`, () => {
      const target = healthy(item);
      const result = handler?.onAfterDamageReceived?.(afterContext(target));
      expect(target.statStages[stat]).toBe(0);
      expect(result?.consumeItem).toBe(false);
    });

    it(`Given ${item} at 25% HP, When the turn ends, Then ${stat} rises and the berry is cleared`, () => {
      const pokemon = pinched(item);
      handler?.onEndTurn?.(endTurnContext(pokemon));
      expect(pokemon.statStages[stat]).toBe(1);
      expect(pokemon.heldItemId).toBeUndefined();
    });
  }
});
