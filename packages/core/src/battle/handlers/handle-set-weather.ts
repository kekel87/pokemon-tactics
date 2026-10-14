import type { EffectKind } from "../../enums/effect-kind";
import { StatName } from "../../enums/stat-name";
import { Weather } from "../../enums/weather";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";
import { effectiveCombatStats } from "../effective-combat-stats";
import { isHeldItemSuppressed } from "../field-global-system";
import { getEffectiveStat } from "../stat-modifier";
import {
  applyWeatherWar,
  effectiveWeatherTurns,
  setWeather,
  WEATHER_DEFAULT_DURATION,
} from "../weather-system";

export function handleSetWeather(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.SetWeather }>;
  const turns = effectiveWeatherTurns(
    isHeldItemSuppressed(context.state, context.attacker) ? undefined : context.attacker.heldItemId,
    effect.weather,
    effect.turns ?? WEATHER_DEFAULT_DURATION,
  );

  if (context.state.weather === Weather.None || context.state.weather === effect.weather) {
    return setWeather(context.state, effect.weather, turns, context.attacker.id);
  }

  const newSetterSpeed = getEffectiveStat(
    effectiveCombatStats(context.attacker).speed,
    context.attacker.statStages[StatName.Speed],
  );
  const currentSetterId = context.state.weatherSetterPokemonId;
  const currentSetter = currentSetterId ? context.state.pokemon.get(currentSetterId) : undefined;
  const currentSetterSpeed = currentSetter
    ? getEffectiveStat(
        effectiveCombatStats(currentSetter).speed,
        currentSetter.statStages[StatName.Speed],
      )
    : Number.POSITIVE_INFINITY;

  const result = applyWeatherWar(
    context.state,
    effect.weather,
    newSetterSpeed,
    currentSetterSpeed,
    context.attacker.id,
    turns,
  );
  return result.events;
}
