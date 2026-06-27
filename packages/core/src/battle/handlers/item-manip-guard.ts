import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import type { PokemonInstance } from "../../types/pokemon-instance";
import type { AbilityHandlerRegistry } from "../ability-handler-registry";
import { isItemProtectedByStickyHold, STICKY_HOLD_ABILITY_ID } from "../held-item-transfer";
import { hasSubstitute } from "../substitute-system";

export type ItemManipGuard =
  | { kind: "ok" }
  | { kind: "skip" }
  | { kind: "blocked"; event: BattleEvent };

/**
 * Shared guard for any move that manipulates the *target's* held item (remove / steal / eat / burn).
 * A Substitute blocks the item effect (the damage already hit the Clone), a fainted or self target is
 * a no-op, and Glu (sticky-hold) protects the holder — surfacing an AbilityActivated event.
 */
export function guardTargetItemManip(
  attacker: PokemonInstance,
  target: PokemonInstance,
  abilityRegistry?: AbilityHandlerRegistry,
): ItemManipGuard {
  if (attacker.id === target.id || target.currentHp <= 0) {
    return { kind: "skip" };
  }
  if (hasSubstitute(target)) {
    return { kind: "skip" };
  }
  if (isItemProtectedByStickyHold(target, abilityRegistry)) {
    return {
      kind: "blocked",
      event: {
        type: BattleEventType.AbilityActivated,
        pokemonId: target.id,
        abilityId: STICKY_HOLD_ABILITY_ID,
        targetIds: [],
      },
    };
  }
  return { kind: "ok" };
}
