import type { BattleEvent } from "../../../types/battle-event";
import { TypeChangeReason } from "../../../types/battle-event";
import type { EffectContext } from "../../effect-handler-registry";
import { applyTypeOverride, typeMoveFailed } from "./apply-type-override";

/**
 * Copie-Type (reflect-type): the caster copies the target's effective types (including any override
 * the target itself carries). Fails if the target is typeless.
 */
export function handleCopyTargetType(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const target = context.targets[0];
  if (!target) {
    return typeMoveFailed(caster.id, context.move);
  }
  const targetTypes = context.targetTypesMap.get(target.id) ?? [];
  if (targetTypes.length === 0) {
    return typeMoveFailed(caster.id, context.move);
  }
  return applyTypeOverride(caster, [...targetTypes], TypeChangeReason.ReflectType);
}
