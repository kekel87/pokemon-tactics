import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";

export function handleHealSelf(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.HealSelf }>;
  const pokemon = context.attacker;
  const healed = Math.min(
    pokemon.maxHp - pokemon.currentHp,
    Math.floor(pokemon.maxHp * effect.percent),
  );
  if (healed <= 0) {
    return [];
  }
  pokemon.currentHp += healed;
  return [{ type: BattleEventType.HpRestored, pokemonId: pokemon.id, amount: healed }];
}
