import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";

/**
 * Effort (endeavor): sets the target's current HP to the caster's current HP, but only when the
 * target has MORE HP than the caster. Otherwise the move fails. Pure HP copy — never KOs the target
 * (it keeps at least the caster's HP, which is ≥ 1 while the caster is alive). Single-target contact;
 * blocked upstream by Protection.
 */
export function handleEndeavor(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const target = context.targets[0];
  if (!target) {
    return [];
  }
  if (target.currentHp <= caster.currentHp) {
    return [{ type: BattleEventType.EndeavorFailed, attackerId: caster.id }];
  }
  const damage = target.currentHp - caster.currentHp;
  target.currentHp = caster.currentHp;
  return [
    {
      type: BattleEventType.EndeavorApplied,
      attackerId: caster.id,
      targetId: target.id,
      damage,
    },
  ];
}
