import { BattleEventType } from "../../../enums/battle-event-type";
import type { BattleEvent } from "../../../types/battle-event";
import type { EffectContext } from "../../effect-handler-registry";
import { effectiveAbilityId } from "../../effective-ability";
import { shouldSubstituteBlock } from "../../substitute-system";
import { applyTransform } from "./apply-transform";

/**
 * Morphing (transform, plan 157): the caster becomes a copy of its target. Fails (MoveFailed, no
 * mutation) when (#653):
 *  - the target is gone / fainted,
 *  - the target is behind a Substitute,
 *  - the caster is already transformed,
 *  - the target is already transformed,
 *  - the target's effective ability is Imposteur (never copy Imposteur — anti-loop, #652).
 *
 * Otherwise it resolves the target's effective types + ability and delegates to `applyTransform`.
 */
export function handleTransform(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const target = context.targets[0];
  const fail: BattleEvent[] = [
    { type: BattleEventType.MoveFailed, attackerId: caster.id, moveId: context.move.id },
  ];

  if (!target || target.currentHp <= 0) {
    return fail;
  }
  if (shouldSubstituteBlock(caster, target, context.move)) {
    return fail;
  }
  if (caster.transformState || target.transformState) {
    return fail;
  }

  const targetAbilityId = effectiveAbilityId(target);
  if (targetAbilityId === "imposter") {
    return fail;
  }

  // `targetTypesMap` is keyed by instance id (not definitionId) and already holds each target's
  // EFFECTIVE types (`effectiveTypesOf`) — so read it directly rather than via `resolveBaseTypes`.
  const targetTypes = context.targetTypesMap.get(target.id) ?? [];
  return applyTransform(caster, target, targetTypes, targetAbilityId);
}
