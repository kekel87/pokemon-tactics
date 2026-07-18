import { BattleEventType } from "../../../enums/battle-event-type";
import type { BattleEvent } from "../../../types/battle-event";
import type { EffectContext } from "../../effect-handler-registry";
import { isHealBlocked } from "../../heal-block-system";

/** Heal fraction of max HP by stockpile layers: 1 → 25%, 2 → 50%, 3 → 100% (canon). */
function swallowHealPercent(layers: number): number {
  if (layers >= 3) {
    return 1;
  }
  if (layers === 2) {
    return 0.5;
  }
  return 0.25;
}

/**
 * Avale (swallow, plan 162): heal the caster by a fraction scaled to its stockpile layers, reading
 * the count BEFORE `ConsumeStockpile` clears it in the same move. The `failsWithoutStockpile` gate
 * fizzles the move at 0 layers, so this handler always runs with ≥1 layer in practice.
 */
export function handleSwallowHeal(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const layers = caster.stockpileCount ?? 0;
  if (layers <= 0) {
    return [];
  }
  if (isHealBlocked(caster)) {
    return [{ type: BattleEventType.HealPrevented, pokemonId: caster.id }];
  }

  const percent = swallowHealPercent(layers);
  const healed = Math.min(caster.maxHp - caster.currentHp, Math.floor(caster.maxHp * percent));
  if (healed <= 0) {
    return [];
  }

  caster.currentHp += healed;
  return [{ type: BattleEventType.HpRestored, pokemonId: caster.id, amount: healed }];
}
