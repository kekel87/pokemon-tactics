import { itemHandlers } from "@pokemon-tactic/data";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { HeldItemId } from "../../enums/held-item-id";
import { PlayerId } from "../../enums/player-id";
import { PokemonType } from "../../enums/pokemon-type";
import { buildItemTestEngine, MockMove, MockPokemon } from "../../testing";
import type { DamageModifyContext } from "../../types/ability-definition";

const TYPE_BOOST_ITEMS: ReadonlyArray<{ item: HeldItemId; type: PokemonType }> = [
  { item: HeldItemId.SilkScarf, type: PokemonType.Normal },
  { item: HeldItemId.Charcoal, type: PokemonType.Fire },
  { item: HeldItemId.MysticWater, type: PokemonType.Water },
  { item: HeldItemId.MiracleSeed, type: PokemonType.Grass },
  { item: HeldItemId.Magnet, type: PokemonType.Electric },
  { item: HeldItemId.NeverMeltIce, type: PokemonType.Ice },
  { item: HeldItemId.BlackBelt, type: PokemonType.Fighting },
  { item: HeldItemId.PoisonBarb, type: PokemonType.Poison },
  { item: HeldItemId.SoftSand, type: PokemonType.Ground },
  { item: HeldItemId.SharpBeak, type: PokemonType.Flying },
  { item: HeldItemId.TwistedSpoon, type: PokemonType.Psychic },
  { item: HeldItemId.SilverPowder, type: PokemonType.Bug },
  { item: HeldItemId.HardStone, type: PokemonType.Rock },
  { item: HeldItemId.SpellTag, type: PokemonType.Ghost },
  { item: HeldItemId.DragonFang, type: PokemonType.Dragon },
  { item: HeldItemId.BlackGlasses, type: PokemonType.Dark },
  { item: HeldItemId.MetalCoat, type: PokemonType.Steel },
  { item: HeldItemId.FairyFeather, type: PokemonType.Fairy },
];

function modifyContext(moveType: PokemonType, isAttacker: boolean): DamageModifyContext {
  const self = MockPokemon.fresh(MockPokemon.base, { id: "self" });
  const opponent = MockPokemon.fresh(MockPokemon.base, { id: "opponent" });
  return {
    self,
    opponent,
    move: MockMove.fresh(MockMove.physical, { type: moveType }),
    isAttacker,
    attackerTypes: [],
    defenderTypes: [],
    effectiveness: 1,
  };
}

describe("Type-boost held items — mapping table", () => {
  for (const { item, type } of TYPE_BOOST_ITEMS) {
    const handler = itemHandlers.find((h) => h.id === item);

    it(`Given ${item}, When attacking with a ${type} move, Then damage multiplier is 1.2`, () => {
      expect(handler?.onDamageModify?.(modifyContext(type, true))).toBe(1.2);
    });

    it(`Given ${item}, When attacking with a move of another type, Then multiplier is 1.0`, () => {
      const otherType = type === PokemonType.Normal ? PokemonType.Fire : PokemonType.Normal;
      expect(handler?.onDamageModify?.(modifyContext(otherType, true))).toBe(1.0);
    });

    it(`Given ${item}, When defending against a ${type} move, Then multiplier is 1.0`, () => {
      expect(handler?.onDamageModify?.(modifyContext(type, false))).toBe(1.0);
    });
  }
});

describe("Type-boost held items", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Mouchoir Soie (silk-scarf, Normal)", () => {
    it("Given attacker with Mouchoir Soie, When uses tackle (Normal), Then damage greater than without item", () => {
      const withItem = damageWith(HeldItemId.SilkScarf, "tackle", { x: 1, y: 0 });
      const without = damageWith(undefined, "tackle", { x: 1, y: 0 });
      expect(withItem.damage).toBeGreaterThan(without.damage);
    });

    it("Given attacker with Mouchoir Soie, When uses water-gun (Water), Then damage same as without item", () => {
      const withItem = damageWith(HeldItemId.SilkScarf, "water-gun", { x: 0, y: 2 });
      const without = damageWith(undefined, "water-gun", { x: 0, y: 2 });
      expect(withItem.damage).toBe(without.damage);
    });
  });

  describe("Eau Mystique (mystic-water, Water)", () => {
    it("Given attacker with Eau Mystique, When uses water-gun (Water), Then damage greater than without item", () => {
      const withItem = damageWith(HeldItemId.MysticWater, "water-gun", { x: 0, y: 2 });
      const without = damageWith(undefined, "water-gun", { x: 0, y: 2 });
      expect(withItem.damage).toBeGreaterThan(without.damage);
    });
  });

  describe("not consumed", () => {
    it("Given attacker with Mouchoir Soie, When uses tackle (Normal), Then item retained and no HeldItemConsumed", () => {
      const withItem = damageWith(HeldItemId.SilkScarf, "tackle", { x: 1, y: 0 });
      expect(withItem.consumed).toBe(false);
      expect(withItem.heldItemAfter).toBe(HeldItemId.SilkScarf);
    });
  });
});

function damageWith(
  heldItemId: HeldItemId | undefined,
  moveId: string,
  targetPosition: { x: number; y: number },
): { damage: number; consumed: boolean; heldItemAfter: HeldItemId | undefined } {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  const target = MockPokemon.fresh(MockPokemon.base, {
    id: "target",
    playerId: PlayerId.Player2,
    position: targetPosition,
    currentHp: 300,
    maxHp: 300,
    combatStats: { hp: 300, attack: 50, defense: 80, spAttack: 50, spDefense: 80, speed: 10 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  const { engine } = buildItemTestEngine([
    MockPokemon.fresh(MockPokemon.squirtle, {
      id: "attacker",
      playerId: PlayerId.Player1,
      position: { x: 0, y: 0 },
      derivedStats: { movement: 3, jump: 1, initiative: 100 },
      heldItemId,
    }),
    target,
  ]);
  const result = engine.submitAction(PlayerId.Player1, {
    kind: ActionKind.UseMove,
    pokemonId: "attacker",
    moveId,
    targetPosition,
  });
  const attackerAfter = engine.getGameState(PlayerId.Player1).pokemon.get("attacker");
  return {
    damage: 300 - target.currentHp,
    consumed: result.events.some((e) => e.type === BattleEventType.HeldItemConsumed),
    heldItemAfter: attackerAfter?.heldItemId,
  };
}
