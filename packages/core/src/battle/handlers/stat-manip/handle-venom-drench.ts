import { BattleEventType } from "../../../enums/battle-event-type";
import { StatName } from "../../../enums/stat-name";
import { StatusType } from "../../../enums/status-type";
import type { BattleEvent } from "../../../types/battle-event";
import { applyStatStage } from "../../apply-stat-stage";
import type { EffectContext } from "../../effect-handler-registry";
import { statManipBlockedBySubstitute } from "../../substitute-system";

const DRENCHED_STATS = [StatName.Attack, StatName.SpAttack, StatName.Speed] as const;

/**
 * Piège de Venin (venom-drench, plan 162): lower the target's Attack, Sp. Atk and Speed by one stage
 * each — but ONLY if the target is poisoned or badly poisoned. Fails otherwise. Blocked by the
 * target's Substitute (parity with the other enemy stat-manip moves).
 */
export function handleVenomDrench(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const target = context.targets[0];
  if (!target || statManipBlockedBySubstitute(caster, target)) {
    return [];
  }

  const poisoned = target.statusEffects.some(
    (effect) => effect.type === StatusType.Poisoned || effect.type === StatusType.BadlyPoisoned,
  );
  if (!poisoned) {
    return [{ type: BattleEventType.MoveFailed, attackerId: caster.id, moveId: context.move.id }];
  }

  const events: BattleEvent[] = [];
  for (const stat of DRENCHED_STATS) {
    events.push(...applyStatStage(target, stat, -1).events);
  }
  return events;
}
