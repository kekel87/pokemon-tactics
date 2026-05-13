import { BattleEventType } from "../enums/battle-event-type";
import { PokemonType } from "../enums/pokemon-type";
import { StatName } from "../enums/stat-name";
import { Weather } from "../enums/weather";
import type { BattleEvent } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";
import type { PokemonInstance } from "../types/pokemon-instance";

export const WEATHER_DEFAULT_DURATION = 5;
export const WEATHER_EXTENDED_DURATION = 8;
export const WEATHER_DAMAGE_FRACTION = 1 / 16;

export function setWeather(
  state: BattleState,
  weather: Weather,
  turns: number = WEATHER_DEFAULT_DURATION,
  setterPokemonId?: string,
): BattleEvent[] {
  state.weather = weather;
  state.weatherTurnsRemaining = weather === Weather.None ? 0 : turns;
  state.weatherSetterPokemonId = setterPokemonId;
  state.weatherLastTickRound = undefined;
  if (weather === Weather.None) {
    return [];
  }
  return [
    {
      type: BattleEventType.WeatherSet,
      weather,
      turns,
      setterPokemonId,
    },
  ];
}

export function clearWeather(state: BattleState): BattleEvent[] {
  const previousWeather = state.weather;
  if (previousWeather === Weather.None) {
    return [];
  }
  state.weather = Weather.None;
  state.weatherTurnsRemaining = 0;
  state.weatherSetterPokemonId = undefined;
  return [{ type: BattleEventType.WeatherCleared, weather: previousWeather }];
}

export function decrementWeatherTimer(state: BattleState): BattleEvent[] {
  if (state.weather === Weather.None || state.weatherTurnsRemaining <= 0) {
    return [];
  }
  state.weatherTurnsRemaining -= 1;
  if (state.weatherTurnsRemaining <= 0) {
    return clearWeather(state);
  }
  return [];
}

export function isWeatherDamageImmune(pokemonTypes: PokemonType[], weather: Weather): boolean {
  if (weather === Weather.Sandstorm) {
    return (
      pokemonTypes.includes(PokemonType.Rock) ||
      pokemonTypes.includes(PokemonType.Ground) ||
      pokemonTypes.includes(PokemonType.Steel)
    );
  }
  return false;
}

export function weatherDealsDamage(weather: Weather): boolean {
  return weather === Weather.Sandstorm;
}

export function computeWeatherDamage(maxHp: number): number {
  return Math.max(1, Math.floor(maxHp * WEATHER_DAMAGE_FRACTION));
}

export function getWeatherBpModifier(moveType: PokemonType, weather: Weather): number {
  if (weather === Weather.Sun) {
    if (moveType === PokemonType.Fire) {
      return 1.5;
    }
    if (moveType === PokemonType.Water) {
      return 0.5;
    }
  }
  if (weather === Weather.Rain) {
    if (moveType === PokemonType.Water) {
      return 1.5;
    }
    if (moveType === PokemonType.Fire) {
      return 0.5;
    }
  }
  return 1.0;
}

const WEATHER_ACCURACY_TABLE: Record<string, Partial<Record<Weather, number>>> = {
  thunder: { [Weather.Sun]: 50, [Weather.Rain]: 100 },
  hurricane: { [Weather.Sun]: 50, [Weather.Rain]: 100 },
  blizzard: { [Weather.Snow]: 100 },
};

export function getWeatherAccuracyOverride(moveId: string, weather: Weather): number | undefined {
  return WEATHER_ACCURACY_TABLE[moveId]?.[weather];
}

export function getWeatherDefenseStatBoost(
  pokemonTypes: PokemonType[],
  stat: StatName,
  weather: Weather,
): number {
  if (weather === Weather.Sandstorm && stat === StatName.SpDefense) {
    if (pokemonTypes.includes(PokemonType.Rock)) {
      return 1.5;
    }
  }
  if (weather === Weather.Snow && stat === StatName.Defense) {
    if (pokemonTypes.includes(PokemonType.Ice)) {
      return 1.5;
    }
  }
  return 1.0;
}

export function getWeatherBallType(weather: Weather): PokemonType {
  switch (weather) {
    case Weather.Sun:
      return PokemonType.Fire;
    case Weather.Rain:
      return PokemonType.Water;
    case Weather.Sandstorm:
      return PokemonType.Rock;
    case Weather.Snow:
      return PokemonType.Ice;
    default:
      return PokemonType.Normal;
  }
}

export function getWeatherBallBp(weather: Weather, basePower = 50): number {
  return weather === Weather.None ? basePower : basePower * 2;
}

export function shouldBlockFreezeInSun(weather: Weather): boolean {
  return weather === Weather.Sun;
}

export interface WeatherWarResult {
  applied: boolean;
  events: BattleEvent[];
}

export function applyWeatherWar(
  state: BattleState,
  newWeather: Weather,
  newSetterSpeed: number,
  currentSetterSpeed: number,
  newSetterPokemonId: string,
  turns: number,
): WeatherWarResult {
  if (state.weather === Weather.None) {
    return { applied: true, events: setWeather(state, newWeather, turns, newSetterPokemonId) };
  }
  if (newSetterSpeed <= currentSetterSpeed) {
    const previousWeather = state.weather;
    const events: BattleEvent[] = [
      {
        type: BattleEventType.WeatherWar,
        previousWeather,
        newWeather,
        winnerPokemonId: newSetterPokemonId,
      },
      ...setWeather(state, newWeather, turns, newSetterPokemonId),
    ];
    return { applied: true, events };
  }
  return { applied: false, events: [] };
}

export function hasSuppressWeatherActive(
  state: BattleState,
  abilityLookup: (pokemon: PokemonInstance) => boolean,
): boolean {
  for (const pokemon of state.pokemon.values()) {
    if (pokemon.currentHp <= 0) {
      continue;
    }
    if (abilityLookup(pokemon)) {
      return true;
    }
  }
  return false;
}

export function effectiveWeather(
  state: BattleState,
  abilityLookup: (pokemon: PokemonInstance) => boolean,
): Weather {
  if (hasSuppressWeatherActive(state, abilityLookup)) {
    return Weather.None;
  }
  return state.weather;
}
