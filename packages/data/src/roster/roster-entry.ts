import type { PokemonType } from "@pokemon-tactic/core";

export interface RosterEntry {
  id: string;
  movepool: string[];
  custom?: {
    name: string;
    types: PokemonType[];
    baseStats: {
      hp: number;
      attack: number;
      defense: number;
      spAttack: number;
      spDefense: number;
      speed: number;
    };
    weight: number;
  };
}
