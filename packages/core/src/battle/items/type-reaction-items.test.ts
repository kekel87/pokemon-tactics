import { itemHandlers } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { HeldItemId } from "../../enums/held-item-id";
import { PokemonType } from "../../enums/pokemon-type";
import { StatName } from "../../enums/stat-name";
import { MockMove, MockPokemon } from "../../testing";
import type { AfterItemDamageContext } from "../../types/held-item-definition";
import type { PokemonInstance } from "../../types/pokemon-instance";

const TYPE_REACTION_ITEMS: ReadonlyArray<{
  item: HeldItemId;
  type: PokemonType;
  stat: StatName;
}> = [
  { item: HeldItemId.AbsorbBulb, type: PokemonType.Water, stat: StatName.SpAttack },
  { item: HeldItemId.CellBattery, type: PokemonType.Electric, stat: StatName.Attack },
  { item: HeldItemId.Snowball, type: PokemonType.Ice, stat: StatName.Attack },
  { item: HeldItemId.LuminousMoss, type: PokemonType.Water, stat: StatName.SpDefense },
];

function afterContext(target: PokemonInstance, moveType: PokemonType): AfterItemDamageContext {
  return {
    target,
    attacker: MockPokemon.fresh(MockPokemon.base, { id: "attacker" }),
    move: MockMove.fresh(MockMove.physical, { type: moveType }),
    damageDealt: 10,
    wasAtMaxHp: false,
    isSuperEffective: false,
    isContact: true,
  };
}

describe("Type-reaction held items", () => {
  for (const { item, type, stat } of TYPE_REACTION_ITEMS) {
    const handler = itemHandlers.find((h) => h.id === item);

    it(`Given ${item}, When hit by a ${type} move, Then ${stat} rises by one stage and the item is consumed`, () => {
      const target = MockPokemon.fresh(MockPokemon.base, { id: "target" });
      const result = handler?.onAfterDamageReceived?.(afterContext(target, type));
      expect(target.statStages[stat]).toBe(1);
      expect(result?.consumeItem).toBe(true);
    });

    it(`Given ${item}, When hit by a Fire move, Then no boost and the item is retained`, () => {
      const target = MockPokemon.fresh(MockPokemon.base, { id: "target" });
      const result = handler?.onAfterDamageReceived?.(afterContext(target, PokemonType.Fire));
      expect(target.statStages[stat]).toBe(0);
      expect(result?.consumeItem).toBe(false);
    });

    it(`Given ${item} with the stat already maxed, When hit by a ${type} move, Then the item is retained`, () => {
      const target = MockPokemon.fresh(MockPokemon.base, {
        id: "target",
        statStages: { ...MockPokemon.base.statStages, [stat]: 6 },
      });
      const result = handler?.onAfterDamageReceived?.(afterContext(target, type));
      expect(result?.consumeItem).toBe(false);
    });
  }
});
