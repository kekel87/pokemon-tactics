import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";
import { swapHeldItems } from "../held-item-transfer";
import { guardTargetItemManip } from "./item-manip-guard";

/**
 * Swap held items with the target (Tour de Magie / Passe-Passe). Either slot may be empty; the move
 * fails only when both are empty. Blocked by Substitute and Glu (sticky-hold).
 */
export function handleSwapItems(context: EffectContext): BattleEvent[] {
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
    const attackerItemBefore = context.attacker.heldItemId;
    const targetItemBefore = target.heldItemId;
    if (attackerItemBefore === undefined && targetItemBefore === undefined) {
      events.push({ type: BattleEventType.ItemMoveFailed, pokemonId: context.attacker.id });
      continue;
    }
    swapHeldItems(context.attacker, target);
    events.push({
      type: BattleEventType.ItemsSwapped,
      pokemonId: context.attacker.id,
      otherId: target.id,
      itemId: targetItemBefore,
      otherItemId: attackerItemBefore,
    });
  }
  return events;
}
