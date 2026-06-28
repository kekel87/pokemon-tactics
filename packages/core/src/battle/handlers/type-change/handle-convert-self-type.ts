import type { BattleEvent } from "../../../types/battle-event";
import { TypeChangeReason } from "../../../types/battle-event";
import type { EffectContext } from "../../effect-handler-registry";
import { applyTypeOverride, typeMoveFailed } from "./apply-type-override";

/**
 * Conversion: the caster takes the type of its first move (`moveIds[0]`), canon Gen 4+. Fails if that
 * move (or its type) is unknown, or if the caster already has that type.
 */
export function handleConvertSelfType(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const firstMoveId = caster.moveIds[0];
  const newType = firstMoveId ? context.moveTypeOf(firstMoveId) : undefined;
  if (newType === undefined || context.attackerTypes.includes(newType)) {
    return typeMoveFailed(caster.id, context.move);
  }
  return applyTypeOverride(caster, [newType], TypeChangeReason.Conversion);
}
