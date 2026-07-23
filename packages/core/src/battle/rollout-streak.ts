import { DynamicPowerKind } from "../enums/dynamic-power-kind";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import { pendingMetronomeSteps } from "./metronome-streak";

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

/**
 * Effective Rollout / Ball'Glace power for the cast a Pokémon is about to perform: the streak power
 * (`rolloutPowerForIndex`), doubled if the caster has used Boul'Armure (defense-curl) this battle
 * (`usedDefenseCurl`) — canon 30 → 480, up to 960 after Boul'Armure. Single source of truth shared
 * by the dynamic-power resolver and any preview.
 */
export function rolloutEffectivePower(pokemon: PokemonInstance, moveId: string): number {
  const base = rolloutPowerForIndex(pendingRolloutIndex(pokemon, moveId));
  return pokemon.usedDefenseCurl === true ? base * 2 : base;
}

/** Dash range for a given cast index: 2 → 5, +1 per consecutive cast, capped at 5. */
export function rolloutRangeForIndex(index: number): number {
  return Math.min(ROLLOUT_MAX_RANGE, ROLLOUT_BASE_RANGE + (index - 1));
}

/**
 * Record a completed move on the caster, updating the Rollout streak: bumped when the move snowballs
 * (`DynamicPowerKind.RolloutStreak`) and continues the same move, clamped to the cap; reset to 0
 * otherwise. Also commits the Métronome same-move streak (consecutive successful uses). Both streaks
 * read the pre-update `lastUsedMoveId`, so they are computed BEFORE overwriting it — making this the
 * only writer of `lastUsedMoveId`.
 */
export function recordLastUsedMove(pokemon: PokemonInstance, move: MoveDefinition): void {
  pokemon.rolloutStreak = isRolloutStreakMove(move)
    ? Math.min(ROLLOUT_MAX_INDEX, pendingRolloutIndex(pokemon, move.id))
    : 0;
  pokemon.metronomeStreak = pendingMetronomeSteps(pokemon, move.id);
  pokemon.lastUsedMoveId = move.id;
}
