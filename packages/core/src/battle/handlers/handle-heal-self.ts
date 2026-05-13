import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import { Weather } from "../../enums/weather";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";
import { effectiveWeather } from "../weather-system";

const WEATHER_HEAL_MOVE_IDS: ReadonlySet<string> = new Set([
  "synthesis",
  "moonlight",
  "morning-sun",
]);

function getWeatherHealPercent(weather: Weather, defaultPercent: number): number {
  switch (weather) {
    case Weather.Sun:
      return 2 / 3;
    case Weather.Rain:
    case Weather.Sandstorm:
    case Weather.Snow:
      return 0.25;
    default:
      return defaultPercent;
  }
}

export function handleHealSelf(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.HealSelf }>;
  const pokemon = context.attacker;

  let percent = effect.percent;
  if (WEATHER_HEAL_MOVE_IDS.has(context.move.id)) {
    const activeWeather = effectiveWeather(context.state, (target) => {
      if (target.currentHp <= 0) {
        return false;
      }
      const handler = context.abilityRegistry?.getForPokemon(target);
      return handler?.suppressesWeatherEffects === true;
    });
    percent = getWeatherHealPercent(activeWeather, effect.percent);
  }

  const healed = Math.min(pokemon.maxHp - pokemon.currentHp, Math.floor(pokemon.maxHp * percent));
  if (healed <= 0) {
    return [];
  }
  pokemon.currentHp += healed;
  return [{ type: BattleEventType.HpRestored, pokemonId: pokemon.id, amount: healed }];
}
