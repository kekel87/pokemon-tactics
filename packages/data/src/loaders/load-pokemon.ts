import type { PokemonDefinition, PokemonType } from "@pokemon-tactic/core";
import type { RosterEntry } from "../roster/roster-entry";
import type { ReferencePokemon } from "./reference-types";

export function loadPokemonFromReference(
  referenceData: ReferencePokemon[],
  roster: RosterEntry[],
): PokemonDefinition[] {
  const referenceById = new Map<string, ReferencePokemon>();
  for (const pokemon of referenceData) {
    referenceById.set(pokemon.id, pokemon);
  }

  return roster.map((entry) => {
    if (entry.custom) {
      return {
        id: entry.id,
        name: entry.custom.name,
        types: entry.custom.types,
        baseStats: entry.custom.baseStats,
        weight: entry.custom.weight,
        movepool: entry.movepool,
        genderRatio: "genderless",
        ...(entry.abilityId ? { abilityId: entry.abilityId } : {}),
      };
    }

    const ref = referenceById.get(entry.id);
    if (!ref) {
      throw new Error(`Pokemon "${entry.id}" not found in reference data`);
    }

    return {
      id: entry.id,
      name: ref.names.en,
      types: ref.types as PokemonType[],
      baseStats: {
        hp: ref.baseStats.hp,
        attack: ref.baseStats.atk,
        defense: ref.baseStats.def,
        spAttack: ref.baseStats.spa,
        spDefense: ref.baseStats.spd,
        speed: ref.baseStats.spe,
      },
      weight: ref.weight,
      movepool: entry.movepool,
      genderRatio: ref.genderRatio,
      ...(entry.abilityId ? { abilityId: entry.abilityId } : {}),
    };
  });
}
