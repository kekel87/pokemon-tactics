import { BattleEventType } from "../../enums/battle-event-type";
import { StatusType } from "../../enums/status-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import type { PhaseResult } from "../turn-pipeline";

export function trappedTickHandler(pokemonId: string, state: BattleState): PhaseResult {
  const pokemon = state.pokemon.get(pokemonId);
  const events: BattleEvent[] = [];

  if (!pokemon) {
    return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
  }

  const trappedStatuses = pokemon.volatileStatuses.filter((v) => v.type === StatusType.Trapped);

  for (const trapped of trappedStatuses) {
    if (trapped.remainingTurns > 0) {
      trapped.remainingTurns--;
    }

    if (trapped.remainingTurns === 0) {
      pokemon.volatileStatuses = pokemon.volatileStatuses.filter((v) => v !== trapped);
      events.push({
        type: BattleEventType.StatusRemoved,
        targetId: pokemonId,
        status: StatusType.Trapped,
      });
      continue;
    }

    if (trapped.damagePerTurn) {
      const damage = Math.max(1, Math.floor(pokemon.maxHp * trapped.damagePerTurn));
      pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
      events.push({
        type: BattleEventType.DamageDealt,
        targetId: pokemonId,
        amount: damage,
        effectiveness: 1,
      });

      if (pokemon.currentHp <= 0) {
        events.push({ type: BattleEventType.PokemonKo, pokemonId: pokemon.id, countdownStart: 0 });
        return { events, skipAction: false, restrictActions: false, pokemonFainted: true };
      }
    }
  }

  return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
}
