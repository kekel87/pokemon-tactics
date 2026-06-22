import type { PokemonInstance } from "../types/pokemon-instance";

/**
 * Moiteur (damp): relational, not field-wide. An explosion move (Destruction) fizzles entirely when
 * a living Moiteur holder is among its targets. Returns that holder (first by id order, so the
 * emitted AbilityActivated is deterministic when several targets carry Moiteur). Boom Final
 * (aftermath) is handled separately: its recoil is cancelled when the recoil recipient has Moiteur.
 */
export function findDampInTargets(
  targets: readonly PokemonInstance[],
): PokemonInstance | undefined {
  let blocker: PokemonInstance | undefined;
  for (const target of targets) {
    if (target.currentHp > 0 && target.abilityId === "damp") {
      if (blocker === undefined || target.id < blocker.id) {
        blocker = target;
      }
    }
  }
  return blocker;
}
