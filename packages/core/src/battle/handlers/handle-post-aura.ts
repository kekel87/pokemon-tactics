import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import { postAura } from "../aura-system";
import type { EffectContext } from "../effect-handler-registry";

export function handlePostAura(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.PostAura }>;
  const aura = postAura(context.state, context.attacker, effect.aura);

  return [
    {
      type: BattleEventType.AuraPosted,
      casterId: context.attacker.id,
      kind: aura.kind,
      durationRounds: aura.remainingRounds,
    },
  ];
}
