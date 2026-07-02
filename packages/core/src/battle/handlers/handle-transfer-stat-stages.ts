import { BattleEventType } from "../../enums/battle-event-type";
import { StatName } from "../../enums/stat-name";
import type { BattleEvent } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";
import { effectiveBaseSpeed } from "../effective-base-speed";
import { computeMovement } from "../stat-modifier";
import { TRANSFERABLE_STATS } from "./baton-pass-stats";

export function handleTransferStatStages(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const target = context.targets[0];
  if (!target) {
    return [];
  }

  const events: BattleEvent[] = [
    {
      type: BattleEventType.BatonPassed,
      casterId: caster.id,
      targetId: target.id,
    },
  ];

  let speedChanged = false;

  for (const stat of TRANSFERABLE_STATS) {
    const casterStage = caster.statStages[stat];
    if (casterStage === 0) {
      continue;
    }
    const previousTarget = target.statStages[stat];
    target.statStages[stat] = casterStage;
    caster.statStages[stat] = 0;

    const targetDelta = casterStage - previousTarget;
    const casterDelta = -casterStage;

    if (targetDelta !== 0) {
      events.push({
        type: BattleEventType.StatChanged,
        targetId: target.id,
        stat,
        stages: targetDelta,
      });
    }

    events.push({
      type: BattleEventType.StatChanged,
      targetId: caster.id,
      stat,
      stages: casterDelta,
    });

    if (stat === StatName.Speed) {
      speedChanged = true;
    }
  }

  if (speedChanged) {
    caster.derivedStats.movement = computeMovement(
      effectiveBaseSpeed(caster),
      caster.statStages[StatName.Speed],
    );
    target.derivedStats.movement = computeMovement(
      effectiveBaseSpeed(target),
      target.statStages[StatName.Speed],
    );
  }

  return events;
}
