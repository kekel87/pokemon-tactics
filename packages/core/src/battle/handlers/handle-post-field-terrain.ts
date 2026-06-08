import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";
import { postFieldTerrain } from "../field-terrain-system";

export function handlePostFieldTerrain(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.PostFieldTerrain }>;
  const zone = postFieldTerrain(context.state, context.attacker, effect.terrain);

  return [
    {
      type: BattleEventType.FieldTerrainPosted,
      casterId: zone.casterId,
      kind: zone.kind,
      anchor: { ...zone.anchor },
      tiles: zone.tiles.map((tile) => ({ ...tile })),
      durationTurns: zone.remainingTurns,
    },
  ];
}
