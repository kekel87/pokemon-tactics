import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import { eatBerry } from "../eat-berry";
import type { EffectContext } from "../effect-handler-registry";
import { removeHeldItem } from "../held-item-transfer";

/**
 * Throw the user's held item at the target (Dégommage). Damage was already dealt by the preceding
 * Damage effect (power = the item's fling power via dynamic power). Here the item's fling secondary
 * lands — a thrown berry is eaten by the target, an orb inflicts its status, etc. — then the user's
 * item is spent (removed, not recyclable). The move is gated to a flingable item at use time.
 */
export function handleFlingItem(context: EffectContext): BattleEvent[] {
  const events: BattleEvent[] = [];
  const item = context.itemRegistry?.getForPokemon(context.attacker);
  // Defensive: the move is gated to a flingable item by getLegalActions + submitAction, so this is
  // unreachable in normal play — it only guards a hand-built action.
  if (item?.flingPower === undefined) {
    return [{ type: BattleEventType.ItemMoveFailed, pokemonId: context.attacker.id }];
  }
  for (const target of context.targets) {
    if (target.currentHp <= 0) {
      continue;
    }
    if (item.isBerry === true) {
      events.push(...eatBerry(target, item));
    } else if (item.onFling) {
      events.push(...item.onFling(target));
    }
  }
  const itemId = removeHeldItem(context.attacker);
  if (itemId !== undefined) {
    events.push({ type: BattleEventType.ItemFlung, pokemonId: context.attacker.id, itemId });
  }
  return events;
}
