import { BattleEventType } from "../../enums/battle-event-type";
import { HeldItemId } from "../../enums/held-item-id";
import type { BattleEvent } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";
import { removeHeldItem } from "../held-item-transfer";
import { guardTargetItemManip } from "./item-manip-guard";

/**
 * Destroy the target's berry or gem with no benefit to anyone (Calcination). Only berries and the
 * Normal Gem are flammable; other held items are untouched. Blocked by Substitute and Glu.
 */
export function handleBurnTargetItem(context: EffectContext): BattleEvent[] {
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
    const item = context.itemRegistry?.getForPokemon(target);
    const isFlammable = item?.isBerry === true || target.heldItemId === HeldItemId.NormalGem;
    if (!isFlammable) {
      continue;
    }
    const itemId = removeHeldItem(target);
    if (itemId !== undefined) {
      events.push({ type: BattleEventType.ItemBurned, pokemonId: target.id, itemId });
    }
  }
  return events;
}
