import { BattleEventType } from "../enums/battle-event-type";
import type { BattleEvent } from "../types/battle-event";

/** Sums every `DamageDealt` event targeting `targetId` (a move can post several: multi-hit, spread, recoil). */
export function damageTo(events: readonly BattleEvent[], targetId: string): number {
  return events
    .filter(
      (event): event is Extract<BattleEvent, { type: typeof BattleEventType.DamageDealt }> =>
        event.type === BattleEventType.DamageDealt && event.targetId === targetId,
    )
    .reduce((sum, event) => sum + event.amount, 0);
}
