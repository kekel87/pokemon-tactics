import { itemHandlers } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { FieldTerrain } from "../../enums/field-terrain";
import { HeldItemId } from "../../enums/held-item-id";
import { PokemonType } from "../../enums/pokemon-type";
import { StatName } from "../../enums/stat-name";
import { MockBattle, MockPokemon } from "../../testing";
import type { FieldZone } from "../../types/field-zone";
import type { ItemEndTurnContext } from "../../types/held-item-definition";
import type { PokemonInstance } from "../../types/pokemon-instance";
import type { Position } from "../../types/position";

const TERRAIN_SEEDS: ReadonlyArray<{
  item: HeldItemId;
  terrain: FieldTerrain;
  stat: StatName;
}> = [
  { item: HeldItemId.ElectricSeed, terrain: FieldTerrain.Electric, stat: StatName.Defense },
  { item: HeldItemId.GrassySeed, terrain: FieldTerrain.Grassy, stat: StatName.Defense },
  { item: HeldItemId.PsychicSeed, terrain: FieldTerrain.Psychic, stat: StatName.SpDefense },
  { item: HeldItemId.MistySeed, terrain: FieldTerrain.Misty, stat: StatName.SpDefense },
];

const SEED_POSITION: Position = { x: 1, y: 1 };

function zone(kind: FieldTerrain): FieldZone {
  return {
    kind,
    casterId: "caster",
    tiles: [SEED_POSITION],
    anchor: SEED_POSITION,
    remainingTurns: 5,
  };
}

function holder(item: HeldItemId): PokemonInstance {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "holder",
    position: { ...SEED_POSITION },
    heldItemId: item,
  });
}

function endTurnContext(
  pokemon: PokemonInstance,
  zones: FieldZone[],
  selfTypes: PokemonType[] = [],
): ItemEndTurnContext {
  const state = MockBattle.stateFrom([pokemon]);
  state.fieldTerrains.push(...zones);
  return { pokemon, state, selfTypes };
}

describe("Terrain seed held items", () => {
  for (const { item, terrain, stat } of TERRAIN_SEEDS) {
    const handler = itemHandlers.find((h) => h.id === item);

    it(`Given ${item} on ${terrain} terrain, When the turn ends, Then ${stat} rises and the seed is cleared`, () => {
      const pokemon = holder(item);
      handler?.onEndTurn?.(endTurnContext(pokemon, [zone(terrain)]));
      expect(pokemon.statStages[stat]).toBe(1);
      expect(pokemon.heldItemId).toBeUndefined();
    });

    it(`Given ${item} on no terrain, When the turn ends, Then no boost and the seed is retained`, () => {
      const pokemon = holder(item);
      expect(handler?.onEndTurn?.(endTurnContext(pokemon, []))).toHaveLength(0);
      expect(pokemon.statStages[stat]).toBe(0);
      expect(pokemon.heldItemId).toBe(item);
    });

    it(`Given ${item} on a non-matching terrain, When the turn ends, Then no boost`, () => {
      const otherTerrain =
        terrain === FieldTerrain.Electric ? FieldTerrain.Grassy : FieldTerrain.Electric;
      const pokemon = holder(item);
      expect(handler?.onEndTurn?.(endTurnContext(pokemon, [zone(otherTerrain)]))).toHaveLength(0);
      expect(pokemon.statStages[stat]).toBe(0);
    });

    it(`Given ${item} held by a Flying holder on ${terrain} terrain, When the turn ends, Then no boost`, () => {
      const pokemon = holder(item);
      const events = handler?.onEndTurn?.(
        endTurnContext(pokemon, [zone(terrain)], [PokemonType.Flying]),
      );
      expect(events).toHaveLength(0);
      expect(pokemon.statStages[stat]).toBe(0);
      expect(pokemon.heldItemId).toBe(item);
    });
  }
});
