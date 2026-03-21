import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";

export function handleLink(context: EffectContext): BattleEvent[] {
  const events: BattleEvent[] = [];
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.Link }>;

  for (const target of context.targets) {
    context.state.activeLinks.push({
      sourceId: context.attacker.id,
      targetId: target.id,
      linkType: effect.linkType,
      remainingTurns: effect.duration,
      maxRange: effect.maxRange,
      drainFraction: effect.drainFraction,
    });

    const linkEvent: BattleEvent = {
      type: BattleEventType.LinkCreated,
      sourceId: context.attacker.id,
      targetId: target.id,
      linkType: effect.linkType,
    };
    events.push(linkEvent);
  }

  return events;
}
