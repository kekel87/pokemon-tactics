import { BattleEventType } from "../../../enums/battle-event-type";
import type { BattleEvent } from "../../../types/battle-event";
import type { EffectContext } from "../../effect-handler-registry";
import { canReceiveSleep } from "../../sleep-eligibility";

/**
 * Bâillement (yawn, plan 154): make the target drowsy. It keeps one normal action next turn, then
 * falls asleep at the end of that turn (the `drowsy-tick-handler` converts `drowsyTurns` → Asleep).
 * Fails if the target is already drowsy, already carries a status, or can't be put to sleep.
 */
export function handleYawn(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const target = context.targets[0];

  if (target === undefined) {
    return [{ type: BattleEventType.MoveFailed, attackerId: caster.id, moveId: context.move.id }];
  }

  const targetTypes = context.targetTypesMap.get(target.id) ?? [];
  if (
    target.drowsyTurns !== undefined ||
    !canReceiveSleep(context.state, target, targetTypes, context.abilityRegistry)
  ) {
    return [{ type: BattleEventType.MoveFailed, attackerId: caster.id, moveId: context.move.id }];
  }

  target.drowsyTurns = 1;
  return [{ type: BattleEventType.Drowsy, targetId: target.id }];
}
