import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import { eatBerry } from "../eat-berry";
import type { EffectContext } from "../effect-handler-registry";
import { removeHeldItem } from "../held-item-transfer";
import { guardTargetItemManip } from "./item-manip-guard";

/**
 * Eat the target's berry (Picore / Piqûre): after damage, if the target holds a berry the user eats
 * it — gaining its effect — and it leaves the target. No berry → just the damage. Blocked by
 * Substitute and Glu (sticky-hold).
 */
export function handleEatTargetBerry(context: EffectContext): BattleEvent[] {
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
    const berry = context.itemRegistry?.getForPokemon(target);
    if (berry?.isBerry !== true) {
      continue;
    }
    removeHeldItem(target);
    events.push({ type: BattleEventType.HeldItemConsumed, pokemonId: target.id, itemId: berry.id });
    events.push(...eatBerry(context.attacker, berry));
  }
  return events;
}
