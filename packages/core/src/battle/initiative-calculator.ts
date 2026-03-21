import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import type { PokemonInstance } from "../types/pokemon-instance";
import { getStatMultiplier } from "./stat-modifier";

export function getEffectiveInitiative(pokemon: PokemonInstance): number {
  const baseInitiative = pokemon.derivedStats.initiative;
  let effective = baseInitiative * getStatMultiplier(pokemon.statStages[StatName.Speed]);

  const isParalyzed = pokemon.statusEffects.some((s) => s.type === StatusType.Paralyzed);
  if (isParalyzed) {
    effective *= 0.5;
  }

  return Math.floor(effective);
}
