import { BattleEventType } from "../enums/battle-event-type";
import type { StatusType } from "../enums/status-type";
import { StatusType as StatusTypeEnum } from "../enums/status-type";
import type { BattleEvent } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";
import type { PokemonInstance } from "../types/pokemon-instance";
import { effectiveHeldItem } from "./effective-held-item";
import type { HeldItemHandlerRegistry } from "./held-item-handler-registry";
import { consumeHeldItem } from "./held-item-transfer";

/** Move-restricting volatiles that Mental Herb (Herbe Mentale) cures the instant they land. */
const RESTRICTING_VOLATILES: ReadonlySet<StatusType> = new Set([
  StatusTypeEnum.Taunted,
  StatusTypeEnum.Encored,
  StatusTypeEnum.Disabled,
  StatusTypeEnum.Infatuated,
  StatusTypeEnum.HealBlocked,
]);

/**
 * Mental Herb (Herbe Mentale): if the holder is afflicted by a move-restricting volatile, the herb
 * is consumed and the volatile is removed immediately. Returns the events to append (item activated,
 * status removed, item consumed), or an empty array when nothing happens. Call right after the
 * volatile has been pushed onto the target.
 */
export function tryMentalHerbCure(
  state: BattleState,
  target: PokemonInstance,
  status: StatusType,
  itemRegistry: HeldItemHandlerRegistry | undefined,
): BattleEvent[] {
  if (!RESTRICTING_VOLATILES.has(status)) {
    return [];
  }
  const item = effectiveHeldItem(state, target, itemRegistry);
  if (item?.curesMoveRestriction !== true) {
    return [];
  }
  const index = target.volatileStatuses.findIndex((volatile) => volatile.type === status);
  if (index === -1) {
    return [];
  }
  target.volatileStatuses.splice(index, 1);
  consumeHeldItem(target);
  return [
    {
      type: BattleEventType.HeldItemActivated,
      pokemonId: target.id,
      itemId: item.id,
      targetIds: [target.id],
    },
    { type: BattleEventType.StatusRemoved, targetId: target.id, status },
    { type: BattleEventType.HeldItemConsumed, pokemonId: target.id, itemId: item.id },
  ];
}
