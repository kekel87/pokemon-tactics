import { EffectKind } from "../../../enums/effect-kind";
import { PokemonType } from "../../../enums/pokemon-type";
import type { BattleEvent } from "../../../types/battle-event";
import { TypeChangeReason } from "../../../types/battle-event";
import type { EffectContext } from "../../effect-handler-registry";
import { shouldSubstituteBlock } from "../../substitute-system";
import { applyTypeOverride, typeMoveFailed } from "./apply-type-override";

/**
 * Détrempage (soak): set the target's type to a single pure type (Water). Blocked by the target's
 * Clone (Substitut). Fails if the target already is exactly that pure type.
 */
export function handleSoakType(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const target = context.targets[0];
  if (!target) {
    return typeMoveFailed(caster.id, context.move);
  }
  if (shouldSubstituteBlock(caster, target, context.move)) {
    return typeMoveFailed(caster.id, context.move);
  }
  const pureType =
    context.effect.kind === EffectKind.SoakType ? context.effect.pureType : PokemonType.Water;
  const targetTypes = context.targetTypesMap.get(target.id) ?? [];
  if (targetTypes.length === 1 && targetTypes[0] === pureType) {
    return typeMoveFailed(caster.id, context.move);
  }
  return applyTypeOverride(target, [pureType], TypeChangeReason.Soak);
}
