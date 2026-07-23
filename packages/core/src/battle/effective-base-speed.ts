import { HeldItemId } from "../enums/held-item-id";
import type { PokemonInstance } from "../types/pokemon-instance";

const DITTO_DEFINITION_ID = "ditto";
const QUICK_POWDER_SPEED_MOD = 2;

/**
 * The raw Speed stat that drives movement + turn order (ctGain). Priority (#656):
 * `speedStatOverride` (Permuvitesse / speed-swap) > `transformState.baseSpeed` (Morphing/Imposteur,
 * plan 157) > species `baseStats.speed`. Poudre Vite (`quick-powder`) then doubles it for an
 * untransformed Métamorph (species-locked, read directly from `heldItemId` — no registry on this
 * path). The InfoPanel base-stat display keeps reading `baseStats.speed` directly (decision #597).
 *
 * Zone Magique (magic-room) suppression is **deliberately not modelled here** (documented carve-out,
 * decision #714): threading `state` through the whole Speed path — including the derived-stat cache
 * recompute sites (`applyStatStage`) that have no `state` — would be a wide, invasive change, and the
 * suppression would be cache-cadence-approximate anyway (movement recomputes on stat change, not when
 * a mon walks in/out of a zone). The only affected case is an *untransformed* Métamorph standing in a
 * Zone Magique, which is practically unreachable (Métamorph transforms turn 1). Registry-driven items
 * ARE suppressed, via `effectiveHeldItem`; Pierrallégée is suppressed via `effectiveWeight(_, state)`.
 */
export function effectiveBaseSpeed(pokemon: PokemonInstance): number {
  const base =
    pokemon.speedStatOverride ?? pokemon.transformState?.baseSpeed ?? pokemon.baseStats.speed;
  let speed = base;
  if (
    pokemon.heldItemId === HeldItemId.QuickPowder &&
    pokemon.definitionId === DITTO_DEFINITION_ID &&
    !pokemon.transformState
  ) {
    speed = base * QUICK_POWDER_SPEED_MOD;
  }
  // Délestage (unburden, plan 163): doubles Speed once the holder has lost/consumed its item.
  if (pokemon.unburdenActive) {
    speed *= 2;
  }
  return speed;
}
