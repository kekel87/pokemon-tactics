import { EffectKind } from "../../../enums/effect-kind";
import { PokemonType } from "../../../enums/pokemon-type";
import type { BattleEvent } from "../../../types/battle-event";
import { TypeChangeReason } from "../../../types/battle-event";
import type { EffectContext } from "../../effect-handler-registry";
import { applyTypeOverride } from "./apply-type-override";

/**
 * Flamme Ultime (burn-up): after dealing damage, the caster loses its Fire type (becomes typeless if
 * mono-Fire). The "user must be Fire" precondition is gated at the engine before damage
 * (`requiresUserType`), so here the type is guaranteed present; the guard is a defensive no-op.
 */
export function handleRemoveType(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const removedType =
    context.effect.kind === EffectKind.RemoveType ? context.effect.removedType : PokemonType.Fire;
  if (!context.attackerTypes.includes(removedType)) {
    return [];
  }
  const newTypes = context.attackerTypes.filter((type) => type !== removedType);
  return applyTypeOverride(caster, newTypes, TypeChangeReason.BurnUp);
}
