import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";
import { hasSubstitute } from "../substitute-system";

/**
 * Charge-Time tax applied to the target's next action (Dépit / spite). PP no longer exist (plan 128),
 * so spite is reinterpreted as a tempo punishment. ~70% of a status move's CT cost (500).
 */
export const SPITE_CT_PENALTY = 350;

/**
 * Dépit ("spite"): posts a one-shot CT penalty on the target, consumed on its next completed action
 * (payCtActionCost) to delay its following turn. Blocked by Substitute (no damage, pure manipulation).
 * Re-casting overwrites the pending penalty (no stack).
 */
export function handleSpiteCtTax(context: EffectContext): BattleEvent[] {
  const events: BattleEvent[] = [];
  const attacker = context.attacker;

  for (const target of context.targets) {
    if (hasSubstitute(target) && attacker.id !== target.id) {
      events.push({ type: BattleEventType.SpiteFailed, pokemonId: target.id });
      continue;
    }
    target.pendingCtPenalty = SPITE_CT_PENALTY;
    events.push({
      type: BattleEventType.SpiteApplied,
      pokemonId: target.id,
      ctPenalty: SPITE_CT_PENALTY,
    });
  }

  return events;
}
