import { DynamicPowerKind } from "../enums/dynamic-power-kind";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";

const ROLLOUT_BASE_RANGE = 2;
const ROLLOUT_MAX_RANGE = 5;
const ROLLOUT_BASE_POWER = 30;
const ROLLOUT_MAX_POWER = 480;
/** Index where both range and power have reached their cap — streak is stored clamped to it. */
const ROLLOUT_MAX_INDEX = 5;

/** A move whose Dash range + power snowball with each consecutive cast (Rollout / Roulade). */
function isRolloutStreakMove(move: MoveDefinition): boolean {
  return move.dynamicPower?.kind === DynamicPowerKind.RolloutStreak;
}

/**
 * 1-based index of the cast a Pokémon is ABOUT to perform: 1 on a fresh start, +1 for each
 * consecutive cast of the same move. Reads the pre-update `lastUsedMoveId`/`rolloutStreak`, so it is
 * the single source of truth shared by range resolution, power resolution and tooltip previews.
 */
export function pendingRolloutIndex(pokemon: PokemonInstance, moveId: string): number {
  const continuing = pokemon.lastUsedMoveId === moveId;
  return (continuing ? (pokemon.rolloutStreak ?? 0) : 0) + 1;
}

/** Base power for a given cast index: 30 → 480, doubling each consecutive cast (canon Rollout). */
export function rolloutPowerForIndex(index: number): number {
  return Math.min(ROLLOUT_MAX_POWER, ROLLOUT_BASE_POWER * 2 ** (index - 1));
}

/** Dash range for a given cast index: 2 → 5, +1 per consecutive cast, capped at 5. */
export function rolloutRangeForIndex(index: number): number {
  return Math.min(ROLLOUT_MAX_RANGE, ROLLOUT_BASE_RANGE + (index - 1));
}

/**
 * Record a completed move on the caster, updating the Rollout streak: bumped when the move snowballs
 * (`DynamicPowerKind.RolloutStreak`) and continues the same move, clamped to the cap; reset to 0
 * otherwise. Computes the bump BEFORE overwriting `lastUsedMoveId`, so it must be the only writer of
 * `lastUsedMoveId`.
 */
export function recordLastUsedMove(pokemon: PokemonInstance, move: MoveDefinition): void {
  pokemon.rolloutStreak = isRolloutStreakMove(move)
    ? Math.min(ROLLOUT_MAX_INDEX, pendingRolloutIndex(pokemon, move.id))
    : 0;
  pokemon.lastUsedMoveId = move.id;
}
