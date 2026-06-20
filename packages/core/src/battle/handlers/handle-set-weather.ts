import type { EffectKind } from "../../enums/effect-kind";
import { HeldItemId } from "../../enums/held-item-id";
import { StatName } from "../../enums/stat-name";
import { Weather } from "../../enums/weather";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";
import { getEffectiveStat } from "../stat-modifier";
import {
  applyWeatherWar,
  setWeather,
  WEATHER_DEFAULT_DURATION,
  WEATHER_EXTENDED_DURATION,
} from "../weather-system";

const WEATHER_EXTENDER_ITEM: Partial<Record<Weather, HeldItemId>> = {
  [Weather.Sun]: HeldItemId.HeatRock,
  [Weather.Rain]: HeldItemId.DampRock,
  [Weather.Sandstorm]: HeldItemId.SmoothRock,
  [Weather.Snow]: HeldItemId.IcyRock,
};

function effectiveTurns(
  setterHeldItemId: HeldItemId | undefined,
  weather: Weather,
  baseTurns: number,
): number {
  if (setterHeldItemId !== undefined && WEATHER_EXTENDER_ITEM[weather] === setterHeldItemId) {
    return WEATHER_EXTENDED_DURATION;
  }
  return baseTurns;
}

export function handleSetWeather(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.SetWeather }>;
  const turns = effectiveTurns(
    context.attacker.heldItemId,
    effect.weather,
    effect.turns ?? WEATHER_DEFAULT_DURATION,
  );

  if (context.state.weather === Weather.None || context.state.weather === effect.weather) {
    return setWeather(context.state, effect.weather, turns, context.attacker.id);
  }

  const newSetterSpeed = getEffectiveStat(
    context.attacker.combatStats.speed,
    context.attacker.statStages[StatName.Speed],
  );
  const currentSetterId = context.state.weatherSetterPokemonId;
  const currentSetter = currentSetterId ? context.state.pokemon.get(currentSetterId) : undefined;
  const currentSetterSpeed = currentSetter
    ? getEffectiveStat(currentSetter.combatStats.speed, currentSetter.statStages[StatName.Speed])
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
