import { BattleEventType } from "../../enums/battle-event-type";
import { StatusType } from "../../enums/status-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import type { PhaseResult } from "../turn-pipeline";

export function seededTickHandler(pokemonId: string, state: BattleState): PhaseResult {
  const pokemon = state.pokemon.get(pokemonId);
  const events: BattleEvent[] = [];

  if (!pokemon) {
    return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
  }

  const seededStatuses = pokemon.volatileStatuses.filter((v) => v.type === StatusType.Seeded);

  for (const seeded of seededStatuses) {
    const source = seeded.sourceId ? state.pokemon.get(seeded.sourceId) : undefined;

    if (source && source.currentHp <= 0) {
      pokemon.volatileStatuses = pokemon.volatileStatuses.filter((v) => v !== seeded);
      events.push({
        type: BattleEventType.StatusRemoved,
        targetId: pokemonId,
        status: StatusType.Seeded,
      });
      continue;
    }

    const drainAmount = Math.max(1, Math.floor(pokemon.maxHp * 0.125));
    pokemon.currentHp = Math.max(0, pokemon.currentHp - drainAmount);

    events.push({
      type: BattleEventType.DamageDealt,
      targetId: pokemonId,
      amount: drainAmount,
      effectiveness: 1,
    });

    if (source && source.currentHp > 0) {
      const healAmount = Math.min(drainAmount, source.maxHp - source.currentHp);
      if (healAmount > 0) {
        source.currentHp += healAmount;
        events.push({
          type: BattleEventType.DamageDealt,
          targetId: source.id,
          amount: -healAmount,
          effectiveness: 1,
        });
      }
    }

    if (pokemon.currentHp <= 0) {
      events.push({ type: BattleEventType.PokemonKo, pokemonId: pokemon.id, countdownStart: 0 });
      return { events, skipAction: false, restrictActions: false, pokemonFainted: true };
    }
  }

  return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
}
