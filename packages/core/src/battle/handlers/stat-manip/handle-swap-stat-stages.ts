import { BattleEventType } from "../../../enums/battle-event-type";
import type { EffectKind } from "../../../enums/effect-kind";
import type { BattleEvent } from "../../../types/battle-event";
import type { Effect } from "../../../types/effect";
import type { EffectContext } from "../../effect-handler-registry";
import { statManipBlockedBySubstitute } from "../../substitute-system";
import { applyStageWrite } from "./apply-stage-write";

/**
 * Permugarde (Déf/Déf Spé) / Permuforce (Atq/Atq Spé) / Permucœur (les 7) : swap the listed stat
 * stages between the caster and the target. Blocked by the target's Substitute (no-op, decision
 * #598).
 */
export function handleSwapStatStages(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.SwapStatStages }>;
  const caster = context.attacker;
  const target = context.targets[0];
  if (!target || statManipBlockedBySubstitute(caster, target)) {
    return [];
  }

  const events: BattleEvent[] = [
    {
      type: BattleEventType.StatStagesSwapped,
      casterId: caster.id,
      targetId: target.id,
      stats: [...effect.stats],
    },
  ];
  for (const stat of effect.stats) {
    const casterValue = caster.statStages[stat];
    const targetValue = target.statStages[stat];
    events.push(...applyStageWrite(caster, stat, targetValue));
    events.push(...applyStageWrite(target, stat, casterValue));
  }
  return events;
}
