import type { BattleEvent } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";

/**
 * Boul'Armure (defense-curl): flag the caster so Roulade (rollout) and Ball'Glace (ice-ball) deal
 * double power for the rest of the battle. Idempotent — re-using the move keeps the flag set. Emits
 * no event of its own; the accompanying Defense +1 (StatChange) already produces the visible feedback.
 */
export function handleMarkDefenseCurl(context: EffectContext): BattleEvent[] {
  context.attacker.usedDefenseCurl = true;
  return [];
}
