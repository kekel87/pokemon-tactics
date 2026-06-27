import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";
import { removeHeldItem } from "../held-item-transfer";
import { guardTargetItemManip } from "./item-manip-guard";

/**
 * Remove the target's held item without making it recyclable (Sabotage post-hit, Gaz Corrosif). The
 * ×1.5 Sabotage damage bonus is applied separately in the damage calc via `move.knockOffBoost`.
 */
export function handleRemoveItem(context: EffectContext): BattleEvent[] {
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
    const itemId = removeHeldItem(target);
    if (itemId !== undefined) {
      events.push({ type: BattleEventType.ItemKnockedOff, pokemonId: target.id, itemId });
    }
  }
  return events;
}
