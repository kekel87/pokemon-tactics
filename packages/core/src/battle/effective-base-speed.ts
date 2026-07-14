import { HeldItemId } from "../enums/held-item-id";
import type { PokemonInstance } from "../types/pokemon-instance";

const DITTO_DEFINITION_ID = "ditto";
const QUICK_POWDER_SPEED_MOD = 2;

/**
 * The raw Speed stat that drives movement + turn order (ctGain). Priority (#656):
 * `speedStatOverride` (Permuvitesse / speed-swap) > `transformState.baseSpeed` (Morphing/Imposteur,
 * plan 157) > species `baseStats.speed`. Poudre Vite (`quick-powder`) then doubles it for an
 * untransformed Métamorph (species-locked, read directly from `heldItemId` — no registry on this
 * path; Zone Magique suppression not modelled here, minor gap). The InfoPanel base-stat display
 * keeps reading `baseStats.speed` directly (decision #597).
 */
export function effectiveBaseSpeed(pokemon: PokemonInstance): number {
  const base =
    pokemon.speedStatOverride ?? pokemon.transformState?.baseSpeed ?? pokemon.baseStats.speed;
  if (
    pokemon.heldItemId === HeldItemId.QuickPowder &&
    pokemon.definitionId === DITTO_DEFINITION_ID &&
    !pokemon.transformState
  ) {
    return base * QUICK_POWDER_SPEED_MOD;
  }
  return base;
}
