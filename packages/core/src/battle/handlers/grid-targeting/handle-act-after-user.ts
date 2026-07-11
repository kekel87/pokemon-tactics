import { BattleEventType } from "../../../enums/battle-event-type";
import type { BattleEvent } from "../../../types/battle-event";
import type { EffectContext } from "../../effect-handler-registry";

/**
 * Après Vous (after-you, plan 155): the target ally is promoted to the strictly-next actor in the CT
 * scheduler. The handler stays engine-free — it flags the ally with `pendingCtPromotion`, and the
 * `BattleEngine` consumes it at the top of the next `advanceTurn` via `promoteToImmediateNext`
 * (mirror of Dépit's `pendingCtPenalty`). No-op if there is no living ally target other than the
 * caster.
 */
export function handleActAfterUser(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const target = context.targets.find(
    (mon) => mon.id !== caster.id && mon.currentHp > 0 && mon.playerId === caster.playerId,
  );
  if (!target) {
    return [];
  }

  target.pendingCtPromotion = true;
  return [{ type: BattleEventType.PromotedToActNext, casterId: caster.id, targetId: target.id }];
}
