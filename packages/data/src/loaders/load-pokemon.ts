import type { PokemonDefinition, PokemonType } from "@pokemon-tactic/core";
import type { PlayablePokemonEntry } from "../playable/playable-pokemon-entry";
import { getLegalMoves } from "../team/learnset-resolver";
import type { ReferencePokemon } from "./reference-types";

export interface LoadPokemonOptions {
  implementedMoveIds: ReadonlySet<string>;
  getOpSetMoveIds: (pokemonId: string) => string[];
}

export function loadPokemonFromReference(
  referenceData: ReferencePokemon[],
  entries: PlayablePokemonEntry[],
  options: LoadPokemonOptions,
): PokemonDefinition[] {
  const referenceById = new Map<string, ReferencePokemon>();
  for (const pokemon of referenceData) {
    referenceById.set(pokemon.id, pokemon);
  }

  return entries.map((entry) => {
    if (entry.custom) {
      return {
        id: entry.id,
        name: entry.custom.name,
        types: entry.custom.types,
        baseStats: entry.custom.baseStats,
        weight: entry.custom.weight,
        movepool: entry.custom.movepool,
        genderRatio: "genderless",
        ...(entry.custom.abilityId ? { abilityId: entry.custom.abilityId } : {}),
        ...(entry.custom.dexNumber === undefined ? {} : { dexNumber: entry.custom.dexNumber }),
      };
    }

    const ref = referenceById.get(entry.id);
    if (!ref) {
      throw new Error(`Pokemon "${entry.id}" not found in reference data`);
    }

    const movepool = deriveMovepool(entry.id, options, entry.excludeMoves);
    const ability1 = ref.abilities.ability1;

    return {
      id: entry.id,
      dexNumber: ref.dexNumber,
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
      movepool,
      genderRatio: ref.genderRatio,
      ...(ability1 ? { abilityId: ability1 } : {}),
    };
  });
}

function deriveMovepool(
  pokemonId: string,
  options: LoadPokemonOptions,
  excludeMoves?: string[],
): string[] {
  const { implementedMoveIds, getOpSetMoveIds } = options;
  const excluded = new Set(excludeMoves ?? []);

  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const moveId of getOpSetMoveIds(pokemonId)) {
    if (implementedMoveIds.has(moveId) && !seen.has(moveId) && !excluded.has(moveId)) {
      ordered.push(moveId);
      seen.add(moveId);
    }
  }

  for (const moveId of getLegalMoves(pokemonId)) {
    if (implementedMoveIds.has(moveId) && !seen.has(moveId) && !excluded.has(moveId)) {
      ordered.push(moveId);
      seen.add(moveId);
    }
  }

  return ordered;
}
