import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import { postDistortion } from "../distortion-system";
import type { EffectContext } from "../effect-handler-registry";

/**
 * Cast Trick Room ("Distorsion"): post a CT-inverting zone around the caster (mirror of the Champs
 * setters — posting on an existing zone's exact epicenter refreshes it, elsewhere a new zone
 * coexists). Emits DistortionPosted.
 */
export function handlePostDistortion(context: EffectContext): BattleEvent[] {
  const zone = postDistortion(context.state, context.attacker);
  return [
    {
      type: BattleEventType.DistortionPosted,
      casterId: zone.casterId,
      anchor: { ...zone.anchor },
      tiles: zone.tiles.map((tile) => ({ ...tile })),
      durationTurns: zone.remainingTurns,
    },
  ];
}
