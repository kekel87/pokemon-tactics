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
  /** National-dex number for picker ordering (custom mons have no reference to derive it from). */
  dexNumber?: number;
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
