import type { PokemonType } from "../../enums/pokemon-type";
import type { BattleEvent } from "../../types/battle-event";
import type { StatusRules } from "../../types/status-rules";
import type { RandomFn } from "../../utils/prng";
import type { AbilityHandlerRegistry } from "../ability-handler-registry";
import { getEffectiveTypes, resolveBaseTypes } from "../effective-flying";
import { applySleep, canReceiveSleep } from "../sleep-eligibility";
import type { PhaseHandler, PhaseResult } from "../turn-pipeline";

interface DrowsyTickDeps {
  random: RandomFn;
  statusRules: StatusRules;
  pokemonTypesMap: ReadonlyMap<string, PokemonType[]>;
  abilityRegistry?: AbilityHandlerRegistry;
}

/**
 * Bâillement (yawn, plan 154): end-turn conversion of drowsiness into sleep. Runs after the drowsy
 * mon has acted this turn (the canon "one action of respite"), so it fires at end-turn, not start.
 * `drowsyTurns` (set to 1 at cast) decrements; at 0 the mon falls asleep if it still can (re-checks
 * the sleep gate — a status/terrain/aura acquired since cast can cancel the conversion silently).
 */
export function createDrowsyTickHandler(deps: DrowsyTickDeps): PhaseHandler {
  return (pokemonId: string, state): PhaseResult => {
    const events: BattleEvent[] = [];
    const pokemon = state.pokemon.get(pokemonId);

    if (!pokemon || pokemon.drowsyTurns === undefined) {
      return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
    }

    pokemon.drowsyTurns--;
    if (pokemon.drowsyTurns > 0) {
      return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
    }

    pokemon.drowsyTurns = undefined;
    const types = getEffectiveTypes(pokemon, resolveBaseTypes(pokemon, deps.pokemonTypesMap));
    if (canReceiveSleep(state, pokemon, types, deps.abilityRegistry)) {
      events.push(...applySleep(pokemon, deps.random, deps.statusRules, deps.abilityRegistry));
    }

    return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
  };
}
