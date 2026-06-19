import { BattleEventType } from "../../enums/battle-event-type";
import { StatusType } from "../../enums/status-type";
import type { BattleEvent } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";

/** Persistent volatile: never ticked (kept out of TIMED_VOLATILES), removed only when the caster KOs. */
const IMPRISON_PERSISTENT = -1;

/**
 * Imprison ("Possessif"): posts the persistent Imprisoning volatile on the caster. While the caster
 * lives, enemies cannot use any move the caster also knows (inverse filter in getLegalActions). Self
 * move → never blocked by Substitute. Re-casting while already active fails cleanly.
 */
export function handlePostImprison(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  if (caster.volatileStatuses.some((volatile) => volatile.type === StatusType.Imprisoning)) {
    return [{ type: BattleEventType.ImprisonFailed, pokemonId: caster.id }];
  }
  caster.volatileStatuses.push({
    type: StatusType.Imprisoning,
    remainingTurns: IMPRISON_PERSISTENT,
  });
  return [{ type: BattleEventType.Imprisoned, pokemonId: caster.id }];
}
