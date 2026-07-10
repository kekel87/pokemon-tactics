import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import type { PhaseResult } from "../turn-pipeline";

/**
 * Vol Magnétik (magnet-rise, plan 154): start-turn decrement of the caster's levitation counter.
 * Decrements unconditionally — even a turn where Gravité / Anti-Air dominate `isEffectivelyFlying`,
 * the counter keeps running in parallel. When it hits 0 the levitation expires.
 */
export function magnetRiseTickHandler(pokemonId: string, state: BattleState): PhaseResult {
  const events: BattleEvent[] = [];
  const pokemon = state.pokemon.get(pokemonId);

  if (pokemon && (pokemon.magnetRiseTurns ?? 0) > 0) {
    pokemon.magnetRiseTurns = (pokemon.magnetRiseTurns ?? 0) - 1;
    if ((pokemon.magnetRiseTurns ?? 0) <= 0) {
      pokemon.magnetRiseTurns = undefined;
      events.push({ type: BattleEventType.MagnetRiseEnded, pokemonId });
    }
  }

  return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
}
