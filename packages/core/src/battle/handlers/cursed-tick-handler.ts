import { BattleEventType } from "../../enums/battle-event-type";
import { StatusType } from "../../enums/status-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import type { PhaseResult } from "../turn-pipeline";

/**
 * Malédiction (curse, plan 154): end-turn Cursed DoT. Mirrors `trapped-tick-handler`'s damagePerTurn
 * loop but on the persistent Cursed volatile (`remainingTurns -1`, never expires). The `sourceId`
 * carried on the volatile attributes a resulting KO to the original Ghost caster.
 */
export function cursedTickHandler(pokemonId: string, state: BattleState): PhaseResult {
  const events: BattleEvent[] = [];
  const pokemon = state.pokemon.get(pokemonId);

  if (!pokemon) {
    return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
  }

  const cursedStatuses = pokemon.volatileStatuses.filter((v) => v.type === StatusType.Cursed);

  for (const cursed of cursedStatuses) {
    if (!cursed.damagePerTurn) {
      continue;
    }
    const damage = Math.max(1, Math.floor(pokemon.maxHp * cursed.damagePerTurn));
    pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
    events.push({
      type: BattleEventType.CurseDamage,
      targetId: pokemonId,
      amount: damage,
      sourceId: cursed.sourceId,
    });

    if (pokemon.currentHp <= 0) {
      events.push({ type: BattleEventType.PokemonKo, pokemonId: pokemon.id, countdownStart: 0 });
      return { events, skipAction: false, restrictActions: false, pokemonFainted: true };
    }
  }

  return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
}
