import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";
import { postEntryHazard } from "../entry-hazard-system";

/**
 * Place an entry-hazard trap on the move's TARGET tile (≠ field-terrain, which posts on the caster).
 * Re-casting the same kind on the same tile stacks a layer (capped). Team-agnostic — affects anyone
 * who later ENTERS the tile. Does NOT damage an occupant standing there. Emits EntryHazardPosted
 * (no-op at layer cap → no event).
 */
export function handlePostEntryHazard(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.PostEntryHazard }>;
  const cell = postEntryHazard(context.state, effect.hazardKind, context.targetPosition);
  if (!cell) {
    return [];
  }
  return [
    {
      type: BattleEventType.EntryHazardPosted,
      kind: cell.kind,
      tile: { ...cell.tile },
      layers: cell.layers,
    },
  ];
}
