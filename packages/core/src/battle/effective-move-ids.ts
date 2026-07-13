import type { PokemonInstance } from "../types/pokemon-instance";

/**
 * The move ids a mon can select right now: the Morphing/Imposteur copy (`transformState.moveIds`,
 * plan 157) replaces the original slots when transformed, otherwise its own `moveIds`. Every action
 * enumeration / guard (`getLegalActions`, `submitAction`) must read through this so a morphed mon
 * offers the copied kit. Per-instance history that references old ids (Rancune-lock, lock-in, Choice)
 * becomes inert because those ids are no longer in the effective set (#651).
 */
export function effectiveMoveIds(pokemon: PokemonInstance): string[] {
  return pokemon.transformState?.moveIds ?? pokemon.moveIds;
}
