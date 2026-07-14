import { HeldItemId } from "../enums/held-item-id";
import type { PokemonInstance } from "../types/pokemon-instance";

const FLOAT_STONE_WEIGHT_MOD = 0.5;

/**
 * The body weight (kg) a mon has right now: the Morphing/Imposteur copy (`transformState.weight`,
 * plan 157) when transformed, otherwise its species `weight`, then halved by Pierrallégée
 * (`float-stone`). Drives weight-based move power (Grosse Puissance / Fracasser). Read directly from
 * `heldItemId` (no registry on this path); Zone Magique suppression not modelled here (minor gap).
 */
export function effectiveWeight(pokemon: PokemonInstance): number {
  const base = pokemon.transformState?.weight ?? pokemon.weight;
  if (pokemon.heldItemId === HeldItemId.FloatStone) {
    return base * FLOAT_STONE_WEIGHT_MOD;
  }
  return base;
}
