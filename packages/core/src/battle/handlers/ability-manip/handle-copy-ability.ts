import type { BattleEvent } from "../../../types/battle-event";
import { AbilityChangeReason } from "../../../types/battle-event";
import type { EffectContext } from "../../effect-handler-registry";
import { effectiveAbilityId } from "../../effective-ability";
import { abilityMoveFailed, applyAbilityChange } from "./apply-ability-change";

/**
 * Imitation (role-play): the caster copies the target's effective ability. Fails if the target has no
 * effective ability (suppressed / none) or if the caster already effectively has it (no-op).
 */
export function handleCopyAbility(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const target = context.targets[0];
  if (!target || target.currentHp <= 0) {
    return abilityMoveFailed(caster.id, context.move);
  }
  const targetAbility = effectiveAbilityId(target);
  if (targetAbility === undefined || effectiveAbilityId(caster) === targetAbility) {
    return abilityMoveFailed(caster.id, context.move);
  }
  return applyAbilityChange(caster, targetAbility, AbilityChangeReason.RolePlay);
}
