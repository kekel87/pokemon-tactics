import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";
import { isHealBlocked } from "../heal-block-system";

export function handleDrain(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.Drain }>;
  const pokemon = context.attacker;

  if (context.shared.lastDamageDealt <= 0) {
    return [];
  }

  // Anti-Soin (Heal Block): the damage already landed; only the heal portion is suppressed.
  if (isHealBlocked(pokemon)) {
    return [{ type: BattleEventType.HealPrevented, pokemonId: pokemon.id }];
  }

  const missing = pokemon.maxHp - pokemon.currentHp;
  if (missing <= 0) {
    return [];
  }

  const healed = Math.min(
    missing,
    Math.max(1, Math.floor(context.shared.lastDamageDealt * effect.fraction)),
  );
  pokemon.currentHp += healed;

  return [{ type: BattleEventType.HpRestored, pokemonId: pokemon.id, amount: healed }];
}
