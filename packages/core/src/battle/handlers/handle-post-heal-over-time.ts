import { BattleEventType } from "../../enums/battle-event-type";
import type { EffectKind } from "../../enums/effect-kind";
import type { BattleEvent } from "../../types/battle-event";
import type { Effect } from "../../types/effect";
import type { EffectContext } from "../effect-handler-registry";

/**
 * Posts a persistent heal-over-time volatile on the caster (ingrain → Ingrain, aqua-ring → AquaRing).
 * The volatile is never decremented (not in the timed-volatile handler) — the end-turn HoT handler
 * heals from it each turn. Re-posting the same kind is a no-op (fails, like Showdown).
 */
export function handlePostHealOverTime(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.PostHealOverTime }>;
  const caster = context.attacker;
  if (caster.volatileStatuses.some((volatile) => volatile.type === effect.status)) {
    return [];
  }
  caster.volatileStatuses.push({ type: effect.status, remainingTurns: 1 });
  return [{ type: BattleEventType.StatusApplied, targetId: caster.id, status: effect.status }];
}
