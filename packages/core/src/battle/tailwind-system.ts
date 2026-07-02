import type { Direction } from "../enums/direction";
import type { BattleState } from "../types/battle-state";
import type { PokemonInstance } from "../types/pokemon-instance";

export const TAILWIND_DEFAULT_DURATION = 5;
/**
 * CT-gain multiplier for a mon aligned with the wind. ×1.5 mirrors a permanent +2 Speed-stage buff
 * ("Hâte") through the CT curve — readable and balanced; a pure ×2 was judged too snowbally because
 * it bypasses the logarithmic ceiling of `computeCtGain` (game-designer review, plan 145).
 */
export const TAILWIND_SPEED_MULTIPLIER = 1.5;

/** Set (or replace) the single active wind, blowing toward `direction`, owned by `caster`. */
export function setTailwind(
  state: BattleState,
  caster: PokemonInstance,
  direction: Direction,
): void {
  state.tailwind = {
    direction,
    remainingTurns: TAILWIND_DEFAULT_DURATION,
    setterPokemonId: caster.id,
  };
}

/**
 * CT-gain multiplier for `pokemon` under the current wind. A mon whose orientation matches the wind
 * direction is boosted by `TAILWIND_SPEED_MULTIPLIER`; otherwise 1.0. The orientation is read live:
 * it only mutates on the mon's own actions/moves, so between two of its turns it is stable — i.e. the
 * "snapshot at the turn boundary" semantics fall out for free.
 */
export function tailwindSpeedMultiplier(state: BattleState, pokemon: PokemonInstance): number {
  if (!state.tailwind) {
    return 1.0;
  }
  return pokemon.orientation === state.tailwind.direction ? TAILWIND_SPEED_MULTIPLIER : 1.0;
}

/**
 * Decrement the wind on its setter's own turn (mirror of the weather model). Returns true when the
 * wind expired this tick (so the caller can emit TailwindEnded).
 */
export function decrementTailwindTimer(state: BattleState, pokemonId: string): boolean {
  const tailwind = state.tailwind;
  if (!tailwind || tailwind.setterPokemonId !== pokemonId) {
    return false;
  }
  tailwind.remainingTurns -= 1;
  if (tailwind.remainingTurns <= 0) {
    state.tailwind = undefined;
    return true;
  }
  return false;
}
