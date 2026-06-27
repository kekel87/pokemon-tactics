import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";
import { stealHeldItem } from "../held-item-transfer";
import { guardTargetItemManip } from "./item-manip-guard";

/**
 * Steal the target's held item (Larcin / Implore). Only succeeds when the user is empty-handed; the
 * preceding Damage effect lands regardless. Blocked by Substitute and Glu (sticky-hold).
 */
export function handleStealItem(context: EffectContext): BattleEvent[] {
  const events: BattleEvent[] = [];
  for (const target of context.targets) {
    const guard = guardTargetItemManip(context.attacker, target, context.abilityRegistry);
    if (guard.kind === "blocked") {
      events.push(guard.event);
      continue;
    }
    if (guard.kind === "skip") {
      continue;
    }
    const itemId = stealHeldItem(context.attacker, target);
    if (itemId !== undefined) {
      events.push({
        type: BattleEventType.ItemStolen,
        thiefId: context.attacker.id,
        victimId: target.id,
        itemId,
      });
    }
  }
  return events;
}
