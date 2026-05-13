import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { Weather } from "../enums/weather";
import type { BattleState } from "../types/battle-state";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";
import { getStatMultiplier } from "./stat-modifier";
import { effectiveWeather } from "./weather-system";

export function getEffectiveInitiative(
  pokemon: PokemonInstance,
  state?: BattleState,
  abilityRegistry?: AbilityHandlerRegistry,
): number {
  const baseInitiative = pokemon.derivedStats.initiative;
  let effective = baseInitiative * getStatMultiplier(pokemon.statStages[StatName.Speed]);

  const isParalyzed = pokemon.statusEffects.some((s) => s.type === StatusType.Paralyzed);
  if (isParalyzed) {
    effective *= 0.5;
  }

  if (state && abilityRegistry) {
    const handler = abilityRegistry.getForPokemon(pokemon);
    if (handler?.weatherSpeedBoost && pokemon.currentHp > 0) {
      const activeWeather = effectiveWeather(state, (target) => {
        if (target.currentHp <= 0) {
          return false;
        }
        const otherHandler = abilityRegistry.getForPokemon(target);
        return otherHandler?.suppressesWeatherEffects === true;
      });
      if (activeWeather === handler.weatherSpeedBoost.weather && activeWeather !== Weather.None) {
        effective *= handler.weatherSpeedBoost.multiplier;
      }
    }
  }

  return Math.floor(effective);
}
