import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { Weather } from "../enums/weather";
import type { BattleState } from "../types/battle-state";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";
import { getStatMultiplier, isMajorStatus } from "./stat-modifier";
import { effectiveWeather } from "./weather-system";

export function getEffectiveInitiative(
  pokemon: PokemonInstance,
  state?: BattleState,
  abilityRegistry?: AbilityHandlerRegistry,
): number {
  const baseInitiative = pokemon.derivedStats.initiative;
  let effective = baseInitiative * getStatMultiplier(pokemon.statStages[StatName.Speed]);

  const handler = state && abilityRegistry ? abilityRegistry.getForPokemon(pokemon) : undefined;
  const hasStatusSpeedBoost =
    handler?.statusSpeedBoost !== undefined &&
    pokemon.currentHp > 0 &&
    pokemon.statusEffects.some((s) => isMajorStatus(s.type));

  // Pied Véloce (quick-feet): ignores the paralysis Speed cut while it boosts Speed instead.
  const isParalyzed = pokemon.statusEffects.some((s) => s.type === StatusType.Paralyzed);
  if (isParalyzed && !hasStatusSpeedBoost) {
    effective *= 0.5;
  }

  if (hasStatusSpeedBoost && handler?.statusSpeedBoost) {
    effective *= handler.statusSpeedBoost.multiplier;
  }

  if (state && abilityRegistry) {
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
