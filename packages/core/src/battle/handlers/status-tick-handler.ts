import { BattleEventType } from "../../enums/battle-event-type";
import { StatusType } from "../../enums/status-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import type { PokemonInstance } from "../../types/pokemon-instance";
import { DEFAULT_STATUS_RULES, type StatusRules } from "../../types/status-rules";
import type { RandomFn } from "../../utils/prng";
import type { PhaseHandler, PhaseResult } from "../turn-pipeline";

function applyDot(pokemon: PokemonInstance, fraction: number, events: BattleEvent[]): boolean {
  const damage = Math.max(1, Math.floor(pokemon.maxHp / fraction));
  pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
  events.push({
    type: BattleEventType.DamageDealt,
    targetId: pokemon.id,
    amount: damage,
    effectiveness: 1,
  });

  if (pokemon.currentHp <= 0) {
    events.push({ type: BattleEventType.PokemonKo, pokemonId: pokemon.id, countdownStart: 0 });
    return true;
  }
  return false;
}

export function createStatusTickHandler(
  random: RandomFn = () => Math.random(),
  rules: StatusRules = DEFAULT_STATUS_RULES,
): PhaseHandler {
  return (pokemonId: string, state: BattleState) =>
    statusTickHandler(pokemonId, state, random, rules);
}

export function statusTickHandler(
  pokemonId: string,
  state: BattleState,
  random: RandomFn = () => Math.random(),
  rules: StatusRules = DEFAULT_STATUS_RULES,
): PhaseResult {
  const pokemon = state.pokemon.get(pokemonId);
  const emptyResult: PhaseResult = {
    events: [],
    skipAction: false,
    restrictActions: false,
    pokemonFainted: false,
  };

  if (!pokemon || pokemon.statusEffects.length === 0) {
    return emptyResult;
  }

  const status = pokemon.statusEffects[0];
  if (!status) {
    return emptyResult;
  }

  const events: BattleEvent[] = [];

  switch (status.type) {
    case StatusType.Burned: {
      const fainted = applyDot(pokemon, 16, events);
      return { events, skipAction: false, restrictActions: false, pokemonFainted: fainted };
    }

    case StatusType.Poisoned: {
      const fainted = applyDot(pokemon, 8, events);
      return { events, skipAction: false, restrictActions: false, pokemonFainted: fainted };
    }

    case StatusType.BadlyPoisoned: {
      pokemon.toxicCounter = Math.min(pokemon.toxicCounter + 1, 15);
      const damage = Math.max(1, Math.floor((pokemon.maxHp * pokemon.toxicCounter) / 16));
      pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
      events.push({
        type: BattleEventType.DamageDealt,
        targetId: pokemon.id,
        amount: damage,
        effectiveness: 1,
      });
      if (pokemon.currentHp <= 0) {
        events.push({ type: BattleEventType.PokemonKo, pokemonId: pokemon.id, countdownStart: 0 });
        return { events, skipAction: false, restrictActions: false, pokemonFainted: true };
      }
      return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
    }

    case StatusType.Asleep: {
      if (status.remainingTurns !== null && status.remainingTurns > 0) {
        status.remainingTurns--;
      }
      if (status.remainingTurns === 0) {
        pokemon.statusEffects = pokemon.statusEffects.filter((s) => s !== status);
        events.push({
          type: BattleEventType.StatusRemoved,
          targetId: pokemonId,
          status: status.type,
        });
        return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
      }
      return { events, skipAction: true, restrictActions: false, pokemonFainted: false };
    }

    case StatusType.Frozen: {
      const turnsFrozen = (status.turnsApplied ?? 0) + 1;
      status.turnsApplied = turnsFrozen;
      const thawRoll = random();
      if (thawRoll < rules.freeze.thawRate || turnsFrozen >= rules.freeze.maxTurns) {
        pokemon.statusEffects = pokemon.statusEffects.filter((s) => s !== status);
        events.push({
          type: BattleEventType.StatusRemoved,
          targetId: pokemonId,
          status: status.type,
        });
        return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
      }
      return { events, skipAction: true, restrictActions: false, pokemonFainted: false };
    }

    case StatusType.Paralyzed: {
      const procRoll = random();
      if (procRoll < rules.paralysis.skipRate) {
        return { events, skipAction: false, restrictActions: true, pokemonFainted: false };
      }
      return emptyResult;
    }

    default:
      return emptyResult;
  }
}
