import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import { SemiInvulnerableState } from "../../types/semi-invulnerable-state";
import type { EffectContext } from "../effect-handler-registry";

/**
 * Anti-Air (smack-down) grounding effect. Sets the persistent `smackedDown` flag on the target: a
 * Flying-type mon then loses its Ground-move immunity and becomes vulnerable to grounded-only entry
 * hazards (both routed through `isEffectivelyGrounded`). If the target is mid-air in a Flying semi-
 * invulnerable state (Vol / Rebond), the airborne charge is cancelled — it is forced back down.
 * Underground / underwater charges (Tunnel / Plongée) are not affected. On a non-Flying target the
 * flag is inert but still set (no failure). Damage is dealt by the move's separate Damage effect.
 */
export function handleSmackDown(context: EffectContext): BattleEvent[] {
  const target = context.targets[0];
  if (!target || target.currentHp <= 0) {
    return [];
  }
  target.smackedDown = true;
  if (target.semiInvulnerableState === SemiInvulnerableState.Flying) {
    // Abort the whole airborne charge (Vol / Rebond): clearing only the semi-invulnerable state would
    // leave the mon stuck "charging" (locked move + "Charge" badge) with nowhere to go. Drop it fully.
    target.semiInvulnerableState = undefined;
    target.chargingMove = undefined;
    target.lockedMoveId = undefined;
  }
  return [{ type: BattleEventType.SmackedDown, targetId: target.id }];
}
