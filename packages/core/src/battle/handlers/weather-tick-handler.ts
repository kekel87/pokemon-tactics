import { BattleEventType } from "../../enums/battle-event-type";
import type { PokemonType } from "../../enums/pokemon-type";
import { Weather } from "../../enums/weather";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import type { AbilityHandlerRegistry } from "../ability-handler-registry";
import type { PhaseHandler, PhaseResult } from "../turn-pipeline";
import {
  computeWeatherDamage,
  decrementWeatherTimer,
  effectiveWeather,
  isWeatherDamageImmune,
  weatherDealsDamage,
} from "../weather-system";

const EMPTY_RESULT: PhaseResult = {
  events: [],
  skipAction: false,
  restrictActions: false,
  pokemonFainted: false,
};

export interface WeatherTickDeps {
  pokemonTypesMap: Map<string, PokemonType[]>;
  abilityRegistry?: AbilityHandlerRegistry;
}

export function createWeatherTickHandler(deps: WeatherTickDeps): PhaseHandler {
  return (pokemonId: string, state: BattleState) => weatherTickHandler(pokemonId, state, deps);
}

export function weatherTickHandler(
  pokemonId: string,
  state: BattleState,
  deps: WeatherTickDeps,
): PhaseResult {
  if (state.weather === Weather.None) {
    return EMPTY_RESULT;
  }
  const pokemon = state.pokemon.get(pokemonId);
  if (!pokemon || pokemon.currentHp <= 0) {
    return EMPTY_RESULT;
  }

  const events: BattleEvent[] = [];

  if (state.weatherLastTickRound !== state.roundNumber) {
    state.weatherLastTickRound = state.roundNumber;
    const decrementEvents = decrementWeatherTimer(state);
    events.push(...decrementEvents);
  }

  const activeWeather = effectiveWeather(state, (target) => {
    if (target.currentHp <= 0) {
      return false;
    }
    const handler = deps.abilityRegistry?.getForPokemon(target);
    return handler?.suppressesWeatherEffects === true;
  });
  if (activeWeather === Weather.None) {
    return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
  }

  if (weatherDealsDamage(activeWeather)) {
    const types = deps.pokemonTypesMap.get(pokemon.definitionId) ?? [];
    if (!isWeatherDamageImmune(types, activeWeather)) {
      const damage = computeWeatherDamage(pokemon.maxHp);
      pokemon.currentHp = Math.max(0, pokemon.currentHp - damage);
      events.push({
        type: BattleEventType.WeatherDamage,
        pokemonId: pokemon.id,
        amount: damage,
        weather: activeWeather,
      });
      if (pokemon.currentHp <= 0) {
        events.push({
          type: BattleEventType.PokemonKo,
          pokemonId: pokemon.id,
          countdownStart: 0,
        });
        return {
          events,
          skipAction: false,
          restrictActions: false,
          pokemonFainted: true,
        };
      }
    }
  }

  return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
}
