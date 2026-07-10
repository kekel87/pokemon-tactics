import type { BattleEvent } from "../../../types/battle-event";
import { AbilityChangeReason } from "../../../types/battle-event";
import type { EffectContext } from "../../effect-handler-registry";
import { effectiveAbilityId } from "../../effective-ability";
import { abilityMoveFailed, applyAbilityChange } from "./apply-ability-change";

/**
 * Échange (skill-swap): swap the effective abilities of the caster and the target. A suppressed side
 * carries "no ability", which propagates through the swap (the receiver becomes suppressed). Fails
 * only if BOTH sides have no effective ability, or if the two effective abilities are already equal.
 */
export function handleSwapAbility(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const target = context.targets[0];
  if (!target || target.currentHp <= 0) {
    return abilityMoveFailed(caster.id, context.move);
  }
  const casterAbility = effectiveAbilityId(caster);
  const targetAbility = effectiveAbilityId(target);
  if (casterAbility === undefined && targetAbility === undefined) {
    return abilityMoveFailed(caster.id, context.move);
  }
  if (casterAbility === targetAbility) {
    return abilityMoveFailed(caster.id, context.move);
  }
  return [
    ...applyAbilityChange(caster, targetAbility, AbilityChangeReason.SkillSwap),
    ...applyAbilityChange(target, casterAbility, AbilityChangeReason.SkillSwap),
  ];
}
