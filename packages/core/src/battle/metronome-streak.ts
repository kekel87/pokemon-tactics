import type { PokemonInstance } from "../types/pokemon-instance";

/** Consecutive same-move uses are capped here (Métronome objet: 10 steps → +100% at most). */
export const METRONOME_MAX_STEPS = 10;
/** Damage boost gained per consecutive same-move use (Métronome objet: +10% each, per reference). */
export const METRONOME_DAMAGE_STEP = 0.1;

/**
 * Number of consecutive successful same-move uses to credit to the move ABOUT to be used (0-based,
 * clamped to the cap). Reads the pre-update `lastUsedMoveId`/`metronomeStreak`/`lastMoveFailed`, so
 * it is the single source of truth shared by the damage modifier and the streak commit
 * (`recordLastUsedMove`). The streak only continues when the move matches AND the previous use did
 * not fail — mirroring Showdown's `moveLastTurnResult` gate.
 */
export function pendingMetronomeSteps(pokemon: PokemonInstance, moveId: string): number {
  const continuing = pokemon.lastUsedMoveId === moveId && pokemon.lastMoveFailed !== true;
  return continuing ? Math.min(METRONOME_MAX_STEPS, (pokemon.metronomeStreak ?? 0) + 1) : 0;
}

/** Damage multiplier for a given step count: 1.0 (fresh) → 2.0 (10 consecutive uses). */
export function metronomeDamageMultiplier(steps: number): number {
  return 1 + METRONOME_DAMAGE_STEP * steps;
}
