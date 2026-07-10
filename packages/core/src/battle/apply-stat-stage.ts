import { BattleEventType } from "../enums/battle-event-type";
import { StatName } from "../enums/stat-name";
import type { BattleEvent } from "../types/battle-event";
import type { PokemonInstance } from "../types/pokemon-instance";
import { effectiveBaseSpeed } from "./effective-base-speed";
import { clampStages, computeMovement } from "./stat-modifier";

/**
 * Raw write of a stat-stage change (clamp to ±6, movement recompute for Speed, fresh-boost stamp,
 * `StatChanged` event). Extracted from `handle-stat-change` so buff/statut moves that apply stages
 * outside the standard secondary-effect gates (Malédiction non-Spectre self-buff, Cognobidon Attack
 * maximise, Acupression random stat — all plan 154) share the exact same write semantics.
 *
 * Callers own their gating (Brise Moule / Brume / Substitute checks) BEFORE calling this — this helper
 * unconditionally applies the change. `handleStatChange` calls it after its enemy-debuff gates.
 */
export function applyStatStage(
  pokemon: PokemonInstance,
  stat: StatName,
  stages: number,
): { events: BattleEvent[]; actualChange: number } {
  const currentStage = pokemon.statStages[stat];
  const newStage = clampStages(currentStage, stages);
  const actualChange = newStage - currentStage;

  if (actualChange === 0) {
    return { events: [], actualChange: 0 };
  }

  pokemon.statStages[stat] = newStage;

  if (actualChange > 0) {
    // Action clock (B3): mark a fresh, un-cashed stat boost (parity with statsRaisedThisTurn).
    pokemon.hasFreshStatBoost = true;
  }

  if (stat === StatName.Speed) {
    pokemon.derivedStats.movement = computeMovement(effectiveBaseSpeed(pokemon), newStage);
  }

  return {
    events: [
      { type: BattleEventType.StatChanged, targetId: pokemon.id, stat, stages: actualChange },
    ],
    actualChange,
  };
}
