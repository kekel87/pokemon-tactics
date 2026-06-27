import { BattleEventType } from "../enums/battle-event-type";
import type { HeldItemId } from "../enums/held-item-id";
import type { BattleEvent } from "../types/battle-event";
import type { HeldItemHandler } from "../types/held-item-definition";
import type { PokemonInstance } from "../types/pokemon-instance";

/**
 * Make `eater` eat a berry — fed via Picore/Piqûre (the target's berry), or hit by a thrown berry
 * (Dégommage). Applies the berry's unconditional `onEaten` effect (defensive anti-type berries have
 * none → no effect), flags `ateBerryThisBattle` (gates Éructation), and records it as the eater's
 * consumed item so it can Recyclage it (canon). Emits the events to append.
 */
export function eatBerry(eater: PokemonInstance, berry: HeldItemHandler): BattleEvent[] {
  const events: BattleEvent[] = [
    { type: BattleEventType.BerryEaten, eaterId: eater.id, itemId: berry.id },
  ];
  if (berry.onEaten) {
    events.push(...berry.onEaten(eater));
  }
  eater.ateBerryThisBattle = true;
  // A berry handler's id is always a HeldItemId at runtime (the registry is keyed by it).
  eater.consumedItemId = berry.id as HeldItemId;
  return events;
}
