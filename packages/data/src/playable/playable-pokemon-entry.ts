import type { PokemonType } from "@pokemon-tactic/core";

export interface PlayablePokemonCustom {
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
  movepool: string[];
  abilityId?: string;
}

export interface PlayablePokemonEntry {
  id: string;
  custom?: PlayablePokemonCustom;
  /**
   * Moves removed from the derived movepool for balance, even if legal + implemented
   * (e.g. expanding-force off Mewtwo — decision #445). Ignored when `custom` sets the movepool.
   */
  excludeMoves?: string[];
}
