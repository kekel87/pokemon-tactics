import type { PokemonType } from "@pokemon-tactic/core";
import type { ReferenceTypeChart } from "./reference-types";

type TypeEffectiveness = Record<PokemonType, Record<PokemonType, number>>;

export function loadTypeChartFromReference(referenceData: ReferenceTypeChart): TypeEffectiveness {
  const result = {} as TypeEffectiveness;

  for (const attackType of referenceData.types) {
    const row = referenceData.effectiveness[attackType];
    if (row) {
      result[attackType as PokemonType] = row as Record<PokemonType, number>;
    }
  }

  return result;
}
