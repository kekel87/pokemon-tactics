import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";
import { recycleConsumedItem } from "../held-item-transfer";

/**
 * Restore the user's last self-consumed item (Recyclage). Fails with no benefit when nothing was
 * consumed or the user already holds an item.
 */
export function handleRecycleItem(context: EffectContext): BattleEvent[] {
  const restored = recycleConsumedItem(context.attacker);
  if (restored === undefined) {
    return [{ type: BattleEventType.ItemMoveFailed, pokemonId: context.attacker.id }];
  }
  return [{ type: BattleEventType.ItemRecycled, pokemonId: context.attacker.id, itemId: restored }];
}
