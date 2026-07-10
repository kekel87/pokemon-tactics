import { BattleEventType } from "../../../enums/battle-event-type";
import type { AbilityChangeReason, BattleEvent } from "../../../types/battle-event";
import type { MoveDefinition } from "../../../types/move-definition";
import type { PokemonInstance } from "../../../types/pokemon-instance";

/**
 * Apply a runtime ability change (ability-manip family, plan 153) and emit `AbilityChanged`.
 * `newAbilityId === undefined` means suppression (Suc Digestif) — the mon behaves as if it had no
 * ability. A concrete id sets the override (Soucigraine / Imitation / Échange), clearing any prior
 * suppression. Mirrors `applyTypeOverride`: a single override at a time, overwriting the previous.
 *
 * Aura re-evaluation (Intimidation / Magnépiège gained or lost) and the grounding/terrain
 * interactions (Lévitation) are NOT triggered here: they are read through `effectiveAbilityId` at
 * use time, and the engine's post-action `emitPositionLinkedChecks` pass re-applies/removes auras.
 */
export function applyAbilityChange(
  pokemon: PokemonInstance,
  newAbilityId: string | undefined,
  reason: AbilityChangeReason,
): BattleEvent[] {
  if (newAbilityId === undefined) {
    pokemon.abilitySuppressed = true;
    pokemon.abilityIdOverride = undefined;
  } else {
    pokemon.abilityIdOverride = newAbilityId;
    pokemon.abilitySuppressed = undefined;
  }
  return [
    {
      type: BattleEventType.AbilityChanged,
      pokemonId: pokemon.id,
      abilityId: newAbilityId,
      reason,
    },
  ];
}

/** A move that does nothing this cast — emitted by the ability-manip handlers on a failed condition. */
export function abilityMoveFailed(attackerId: string, move: MoveDefinition): BattleEvent[] {
  return [{ type: BattleEventType.MoveFailed, attackerId, moveId: move.id }];
}
