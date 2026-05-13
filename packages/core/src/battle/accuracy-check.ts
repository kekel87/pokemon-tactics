import { StatName } from "../enums/stat-name";
import { StatusType } from "../enums/status-type";
import { Weather } from "../enums/weather";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { RandomFn } from "../utils/prng";
import type { AbilityHandlerRegistry } from "./ability-handler-registry";
import { getStatMultiplier } from "./stat-modifier";
import { effectiveWeather, getWeatherAccuracyOverride } from "./weather-system";

export function checkAccuracy(
  move: MoveDefinition,
  attacker: PokemonInstance,
  defender: PokemonInstance,
  random: RandomFn = () => Math.random(),
  terrainEvasionBonus = 0,
  abilityRegistry?: AbilityHandlerRegistry,
  state?: BattleState,
): boolean {
  const lockedOnIndex = attacker.volatileStatuses.findIndex((v) => v.type === StatusType.LockedOn);
  if (lockedOnIndex !== -1) {
    attacker.volatileStatuses.splice(lockedOnIndex, 1);
    return true;
  }

  if (move.bypassAccuracy) {
    return true;
  }

  const accuracyStages = attacker.statStages[StatName.Accuracy];
  let evasionStages = defender.statStages[StatName.Evasion] + terrainEvasionBonus;

  let activeWeather: Weather = Weather.None;
  if (state) {
    activeWeather = effectiveWeather(state, (target) => {
      if (target.currentHp <= 0) {
        return false;
      }
      const handler = abilityRegistry?.getForPokemon(target);
      return handler?.suppressesWeatherEffects === true;
    });
    const defenderAbility = abilityRegistry?.getForPokemon(defender);
    if (
      defenderAbility?.weatherEvasionBoost &&
      defenderAbility.weatherEvasionBoost.weather === activeWeather &&
      activeWeather !== Weather.None
    ) {
      evasionStages += defenderAbility.weatherEvasionBoost.stages;
    }
  }

  const accuracyMultiplier = getStatMultiplier(accuracyStages);
  const evasionMultiplier = getStatMultiplier(evasionStages);
  const abilityAccBonus = abilityRegistry?.getForPokemon(attacker)?.accuracyMultiplier ?? 1;

  const weatherAccuracyOverride =
    state && activeWeather !== Weather.None
      ? getWeatherAccuracyOverride(move.id, activeWeather)
      : undefined;
  const baseAccuracy = weatherAccuracyOverride ?? move.accuracy;

  const effectiveAccuracy =
    (baseAccuracy * accuracyMultiplier * abilityAccBonus) / evasionMultiplier;

  if (effectiveAccuracy >= 100) {
    return true;
  }

  return random() * 100 < effectiveAccuracy;
}
