import { BattleEventType } from "../../../enums/battle-event-type";
import type { BattleEvent } from "../../../types/battle-event";
import type { EffectContext } from "../../effect-handler-registry";
import { statManipBlockedBySubstitute } from "../../substitute-system";
import { TRANSFERABLE_STATS } from "../baton-pass-stats";
import { applyStageWrite } from "./apply-stage-write";

/**
 * Boost (psych-up): the caster copies the target's 7 stat stages. Blocked by the target's Substitute
 * (no-op, decision #598).
 */
export function handleCopyStatStages(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const target = context.targets[0];
  if (!target || statManipBlockedBySubstitute(caster, target)) {
    return [];
  }

  const events: BattleEvent[] = [
    { type: BattleEventType.StatStagesCopied, casterId: caster.id, targetId: target.id },
  ];
  for (const stat of TRANSFERABLE_STATS) {
    events.push(...applyStageWrite(caster, stat, target.statStages[stat]));
  }
  return events;
}
