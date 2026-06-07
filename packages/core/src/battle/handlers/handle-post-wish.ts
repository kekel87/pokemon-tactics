import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";

/**
 * Schedules a delayed Wish heal on the target ally (or self). The heal amount is frozen at cast
 * (percent of the caster's max HP) and fires on the target's next turn (BattleEngine start-turn),
 * following the mon, not the tile. Re-casting overwrites the pending wish (no stack).
 */
export function handlePostWish(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.PostWish }>;
  const target = context.targets[0] ?? context.attacker;
  const healAmount = Math.floor(context.attacker.maxHp * effect.percent);
  target.pendingWish = { healAmount, castAtAction: context.state.actionCounter ?? 0 };
  return [
    {
      type: BattleEventType.WishPosted,
      casterId: context.attacker.id,
      targetId: target.id,
    },
  ];
}
