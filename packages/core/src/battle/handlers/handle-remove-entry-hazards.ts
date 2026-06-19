import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";
import { removeEntryHazardsNear } from "../entry-hazard-system";

/**
 * Clear every entry-hazard trap within `radius` Manhattan of the user (Tour Rapide / Anti-Brume).
 * Canon: a remover clears the user's side, modelled here as a radius around the user. Emits
 * EntryHazardRemoved (no-op → no event).
 */
export function handleRemoveEntryHazards(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.RemoveEntryHazards }>;
  const removed = removeEntryHazardsNear(context.state, context.attacker.position, effect.radius);
  if (removed.length === 0) {
    return [];
  }
  return [
    {
      type: BattleEventType.EntryHazardRemoved,
      tiles: removed.map((cell) => ({ ...cell.tile })),
    },
  ];
}
