import { BattleEventType } from "../../enums/battle-event-type";
import { StatusType } from "../../enums/status-type";
import type { BattleEvent } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";

/**
 * Rancune (grudge): posts the volatile on the caster. Cleared at the START of the caster's next turn
 * by `sacrificeBondExpireHandler` ("until the user's next turn"), so `remainingTurns` is a nominal
 * marker. If the caster is KO'd by a move while it holds, `handleKo` permanently locks that move on
 * its attacker. Re-casting is idempotent.
 */
export function handlePostGrudge(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const existing = caster.volatileStatuses.find((v) => v.type === StatusType.Grudge);
  if (!existing) {
    caster.volatileStatuses.push({ type: StatusType.Grudge, remainingTurns: 1 });
  }
  return [{ type: BattleEventType.GrudgePosted, casterId: caster.id }];
}
