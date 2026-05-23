import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";
import { postScreen } from "../screens-system";

export function handlePostScreen(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.PostScreen }>;
  const aura = postScreen(context.state, context.attacker, effect.screen);

  return [
    {
      type: BattleEventType.ScreenPosted,
      casterId: context.attacker.id,
      kind: aura.kind,
      durationRounds: aura.remainingRounds,
    },
  ];
}
