import { BattleEventType } from "../../enums/battle-event-type";
import { StatusType } from "../../enums/status-type";
import type { BattleEvent } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";

/**
 * Lien du Destin (destiny-bond): posts the volatile on the caster. It is cleared at the START of the
 * caster's next turn by `sacrificeBondExpireHandler` (the "until the user's next turn" window), so the
 * `remainingTurns` value is just a nominal marker. If the caster is KO'd while it holds, `handleKo`
 * drags the killer down too. Re-casting is idempotent.
 */
export function handlePostDestinyBond(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const existing = caster.volatileStatuses.find((v) => v.type === StatusType.DestinyBond);
  if (!existing) {
    caster.volatileStatuses.push({ type: StatusType.DestinyBond, remainingTurns: 1 });
  }
  return [{ type: BattleEventType.DestinyBondPosted, casterId: caster.id }];
}
