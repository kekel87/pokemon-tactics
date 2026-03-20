import type { PokemonType } from "../enums/pokemon-type";
import type { BaseStats } from "./base-stats";

export interface PokemonDefinition {
  id: string;
  name: string;
  types: PokemonType[];
  baseStats: BaseStats;
  weight: number;
  movepool: string[];
}
