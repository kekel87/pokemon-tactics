import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import type { StatusType } from "../../enums/status-type";
import { StatusType as StatusTypeEnum } from "../../enums/status-type";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";
import { isMajorStatus } from "../stat-modifier";

const VOLATILE_STATUSES: ReadonlySet<StatusType> = new Set([StatusTypeEnum.Confused]);

export function handleStatus(context: EffectContext): BattleEvent[] {
  const events: BattleEvent[] = [];
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.Status }>;

  for (const target of context.targets) {
    if (Math.random() * 100 >= effect.chance) {
      continue;
    }

    if (isVolatileStatus(effect.status)) {
      const alreadyHas = target.volatileStatuses.some((v) => v.type === effect.status);
      if (alreadyHas) {
        continue;
      }
      const remainingTurns = getStatusDuration(effect.status) ?? 1;
      target.volatileStatuses.push({ type: effect.status, remainingTurns });
    } else {
      const targetHasMajor = target.statusEffects.some((s) => isMajorStatus(s.type));
      if (targetHasMajor && isMajorStatus(effect.status)) {
        continue;
      }
      const remainingTurns = getStatusDuration(effect.status);
      target.statusEffects.push({ type: effect.status, remainingTurns });
    }

    const statusEvent: BattleEvent = {
      type: BattleEventType.StatusApplied,
      targetId: target.id,
      status: effect.status,
    };
    events.push(statusEvent);
  }

  return events;
}

function isVolatileStatus(status: StatusType): boolean {
  return VOLATILE_STATUSES.has(status);
}

function getStatusDuration(status: StatusType): number | null {
  switch (status) {
    case StatusTypeEnum.Asleep:
      return Math.floor(Math.random() * 3) + 1;
    case StatusTypeEnum.Confused:
      return Math.floor(Math.random() * 4) + 1;
    default:
      return null;
  }
}
