import { BattleEventType } from "../../../enums/battle-event-type";
import { EffectKind } from "../../../enums/effect-kind";
import { StatusType } from "../../../enums/status-type";
import type { BattleEvent } from "../../../types/battle-event";
import { AbilityChangeReason } from "../../../types/battle-event";
import type { EffectContext } from "../../effect-handler-registry";
import { effectiveAbilityId } from "../../effective-ability";
import { abilityMoveFailed, applyAbilityChange } from "./apply-ability-change";

/**
 * Soucigraine (worry-seed): replace the target's ability with a fixed one (Insomnie / insomnia).
 * Fails if the target already effectively has that ability. Canon side effect: setting Insomnie wakes
 * a sleeping target (Insomnie forbids sleep).
 */
export function handleSetAbility(context: EffectContext): BattleEvent[] {
  const target = context.targets[0];
  if (!target || target.currentHp <= 0) {
    return abilityMoveFailed(context.attacker.id, context.move);
  }
  if (context.effect.kind !== EffectKind.SetAbility) {
    return abilityMoveFailed(context.attacker.id, context.move);
  }
  const newAbilityId = context.effect.abilityId;
  if (effectiveAbilityId(target) === newAbilityId) {
    return abilityMoveFailed(context.attacker.id, context.move);
  }

  const events = applyAbilityChange(target, newAbilityId, AbilityChangeReason.SetByMove);

  if (newAbilityId === "insomnia") {
    const index = target.statusEffects.findIndex((status) => status.type === StatusType.Asleep);
    if (index >= 0) {
      target.statusEffects.splice(index, 1);
      events.push({
        type: BattleEventType.StatusRemoved,
        targetId: target.id,
        status: StatusType.Asleep,
      });
    }
  }

  return events;
}
