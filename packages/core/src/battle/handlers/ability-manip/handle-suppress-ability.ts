import type { BattleEvent } from "../../../types/battle-event";
import { AbilityChangeReason } from "../../../types/battle-event";
import type { EffectContext } from "../../effect-handler-registry";
import { effectiveAbilityId } from "../../effective-ability";
import { abilityMoveFailed, applyAbilityChange } from "./apply-ability-change";

/**
 * Suc Digestif (gastro-acid): suppress the target's ability for the rest of the battle. Fails if the
 * target already has no effective ability (already suppressed) or holds an `unsuppressable` ability
 * (no Gen 1 roster ability is, but the gate is honoured for correctness).
 */
export function handleSuppressAbility(context: EffectContext): BattleEvent[] {
  const target = context.targets[0];
  if (!target || target.currentHp <= 0) {
    return abilityMoveFailed(context.attacker.id, context.move);
  }
  const current = effectiveAbilityId(target);
  if (current === undefined) {
    return abilityMoveFailed(context.attacker.id, context.move);
  }
  if (context.abilityRegistry?.get(current)?.unsuppressable === true) {
    return abilityMoveFailed(context.attacker.id, context.move);
  }
  return applyAbilityChange(target, undefined, AbilityChangeReason.GastroAcid);
}
