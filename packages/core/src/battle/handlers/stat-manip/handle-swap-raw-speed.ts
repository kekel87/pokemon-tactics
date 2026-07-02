import { BattleEventType } from "../../../enums/battle-event-type";
import { StatName } from "../../../enums/stat-name";
import type { BattleEvent } from "../../../types/battle-event";
import type { EffectContext } from "../../effect-handler-registry";
import { effectiveBaseSpeed } from "../../effective-base-speed";
import { computeMovement } from "../../stat-modifier";
import { statManipBlockedBySubstitute } from "../../substitute-system";

/**
 * Permuvitesse (speed-swap, Gen 7 canon): swap the RAW Speed stat — not the stage — between the
 * caster and the target, via the by-instance `speedStatOverride`. Recomputes movement for both (the
 * new base flows into ctGain automatically). Blocked by the target's Substitute (no-op, decision
 * #598).
 */
export function handleSwapRawSpeed(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const target = context.targets[0];
  if (!target || statManipBlockedBySubstitute(caster, target)) {
    return [];
  }

  const casterSpeed = effectiveBaseSpeed(caster);
  const targetSpeed = effectiveBaseSpeed(target);
  caster.speedStatOverride = targetSpeed;
  target.speedStatOverride = casterSpeed;

  caster.derivedStats.movement = computeMovement(
    effectiveBaseSpeed(caster),
    caster.statStages[StatName.Speed],
  );
  target.derivedStats.movement = computeMovement(
    effectiveBaseSpeed(target),
    target.statStages[StatName.Speed],
  );

  return [{ type: BattleEventType.SpeedSwapped, casterId: caster.id, targetId: target.id }];
}
