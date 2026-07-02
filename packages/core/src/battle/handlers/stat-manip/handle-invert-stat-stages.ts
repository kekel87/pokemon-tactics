import { BattleEventType } from "../../../enums/battle-event-type";
import type { BattleEvent } from "../../../types/battle-event";
import type { EffectContext } from "../../effect-handler-registry";
import { statManipBlockedBySubstitute } from "../../substitute-system";
import { TRANSFERABLE_STATS } from "../baton-pass-stats";
import { applyStageWrite } from "./apply-stage-write";

/**
 * Renversement (topsy-turvy): invert the sign of the target's 7 stat stages (+2 → −2, 0 stays 0).
 * Blocked by the target's Substitute (no-op, decision #598).
 */
export function handleInvertStatStages(context: EffectContext): BattleEvent[] {
  const target = context.targets[0];
  if (!target || statManipBlockedBySubstitute(context.attacker, target)) {
    return [];
  }

  const events: BattleEvent[] = [{ type: BattleEventType.StatStagesInverted, targetId: target.id }];
  for (const stat of TRANSFERABLE_STATS) {
    events.push(...applyStageWrite(target, stat, -target.statStages[stat]));
  }
  return events;
}
