import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";
import { postFieldGlobalZone } from "../field-global-system";

/**
 * Cast a localized "field global" effect (Gravité / Zone Étrange / Zone Magique): post a zone of
 * the effect's `fieldGlobalKind` around the caster (mirror of the Distorsion / Champs setters —
 * posting the same kind on an existing same-kind epicenter refreshes it). Emits FieldGlobalPosted.
 */
export function handlePostFieldGlobal(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.PostFieldGlobal }>;
  const zone = postFieldGlobalZone(context.state, context.attacker, effect.fieldGlobalKind);
  return [
    {
      type: BattleEventType.FieldGlobalPosted,
      casterId: zone.casterId,
      kind: zone.kind,
      anchor: { ...zone.anchor },
      tiles: zone.tiles.map((tile) => ({ ...tile })),
      durationTurns: zone.remainingTurns,
    },
  ];
}
