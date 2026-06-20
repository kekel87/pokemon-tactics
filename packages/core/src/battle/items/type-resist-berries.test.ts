import { itemHandlers } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { HeldItemId } from "../../enums/held-item-id";
import { PokemonType } from "../../enums/pokemon-type";
import { MockMove, MockPokemon } from "../../testing";
import type { DamageModifyContext } from "../../types/ability-definition";
import type { AfterItemDamageContext } from "../../types/held-item-definition";

const TYPE_RESIST_BERRIES: ReadonlyArray<{ item: HeldItemId; type: PokemonType }> = [
  { item: HeldItemId.OccaBerry, type: PokemonType.Fire },
  { item: HeldItemId.PasshoBerry, type: PokemonType.Water },
  { item: HeldItemId.WacanBerry, type: PokemonType.Electric },
  { item: HeldItemId.RindoBerry, type: PokemonType.Grass },
  { item: HeldItemId.YacheBerry, type: PokemonType.Ice },
  { item: HeldItemId.ChopleBerry, type: PokemonType.Fighting },
  { item: HeldItemId.KebiaBerry, type: PokemonType.Poison },
  { item: HeldItemId.ShucaBerry, type: PokemonType.Ground },
  { item: HeldItemId.CobaBerry, type: PokemonType.Flying },
  { item: HeldItemId.PayapaBerry, type: PokemonType.Psychic },
  { item: HeldItemId.TangaBerry, type: PokemonType.Bug },
  { item: HeldItemId.ChartiBerry, type: PokemonType.Rock },
  { item: HeldItemId.KasibBerry, type: PokemonType.Ghost },
  { item: HeldItemId.HabanBerry, type: PokemonType.Dragon },
  { item: HeldItemId.ColburBerry, type: PokemonType.Dark },
  { item: HeldItemId.BabiriBerry, type: PokemonType.Steel },
  { item: HeldItemId.ChilanBerry, type: PokemonType.Normal },
  { item: HeldItemId.RoseliBerry, type: PokemonType.Fairy },
];

function modifyContext(
  moveType: PokemonType,
  effectiveness: number,
  isAttacker: boolean,
): DamageModifyContext {
  return {
    self: MockPokemon.fresh(MockPokemon.base, { id: "self" }),
    opponent: MockPokemon.fresh(MockPokemon.base, { id: "opponent" }),
    move: MockMove.fresh(MockMove.physical, { type: moveType }),
    isAttacker,
    attackerTypes: [],
    defenderTypes: [],
    effectiveness,
  };
}

function afterContext(moveType: PokemonType, isSuperEffective: boolean): AfterItemDamageContext {
  return {
    target: MockPokemon.fresh(MockPokemon.base, { id: "target" }),
    attacker: MockPokemon.fresh(MockPokemon.base, { id: "attacker" }),
    move: MockMove.fresh(MockMove.physical, { type: moveType }),
    damageDealt: 10,
    wasAtMaxHp: true,
    isSuperEffective,
    isContact: true,
  };
}

describe("Type-resist berries — mapping table", () => {
  for (const { item, type } of TYPE_RESIST_BERRIES) {
    const handler = itemHandlers.find((h) => h.id === item);
    const isNormal = type === PokemonType.Normal;
    const otherType = type === PokemonType.Fire ? PokemonType.Water : PokemonType.Fire;

    it(`Given ${item}, When defending against a super-effective ${type} move, Then multiplier is 0.5`, () => {
      expect(handler?.onDamageModify?.(modifyContext(type, 2, false))).toBe(0.5);
    });

    it(`Given ${item}, When defending against a neutral ${type} move, Then multiplier is ${isNormal ? 0.5 : 1.0}`, () => {
      expect(handler?.onDamageModify?.(modifyContext(type, 1, false))).toBe(isNormal ? 0.5 : 1.0);
    });

    it(`Given ${item}, When attacking with a ${type} move, Then multiplier is 1.0`, () => {
      expect(handler?.onDamageModify?.(modifyContext(type, 2, true))).toBe(1.0);
    });

    it(`Given ${item}, When defending against a super-effective move of another type, Then multiplier is 1.0`, () => {
      expect(handler?.onDamageModify?.(modifyContext(otherType, 2, false))).toBe(1.0);
    });

    it(`Given ${item}, When the resisted hit lands, Then the berry is consumed`, () => {
      expect(handler?.onAfterDamageReceived?.(afterContext(type, true)).consumeItem).toBe(true);
    });

    it(`Given ${item}, When a hit of another type lands, Then the berry is retained`, () => {
      expect(handler?.onAfterDamageReceived?.(afterContext(otherType, true)).consumeItem).toBe(
        false,
      );
    });
  }
});
