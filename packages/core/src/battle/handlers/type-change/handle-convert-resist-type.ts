import { PokemonType } from "../../../enums/pokemon-type";
import type { BattleEvent } from "../../../types/battle-event";
import { TypeChangeReason } from "../../../types/battle-event";
import { getTypeEffectiveness } from "../../damage-calculator";
import type { EffectContext } from "../../effect-handler-registry";
import { applyTypeOverride, typeMoveFailed } from "./apply-type-override";

/** Single types that take less-than-neutral damage (resist or immune) from `attackType`. */
function resistingTypes(
  attackType: PokemonType,
  typeChart: EffectContext["typeChart"],
): PokemonType[] {
  return Object.values(PokemonType).filter(
    (candidate) => getTypeEffectiveness(attackType, [candidate], typeChart) < 1,
  );
}

/**
 * Conversion 2: the caster becomes a single type that resists the last move used by an adjacent enemy.
 * Picks at random among the resisting types. Fails if the target hasn't acted, the move type is
 * unknown (typeless), or nothing resists it.
 */
export function handleConvertResistType(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const target = context.targets[0];
  if (!target) {
    return typeMoveFailed(caster.id, context.move);
  }
  const lastMoveId = target.lastUsedMoveId;
  const attackType = lastMoveId ? context.moveTypeOf(lastMoveId) : undefined;
  if (attackType === undefined) {
    return typeMoveFailed(caster.id, context.move);
  }
  const candidates = resistingTypes(attackType, context.typeChart);
  if (candidates.length === 0) {
    return typeMoveFailed(caster.id, context.move);
  }
  const chosen = candidates[Math.floor(context.random() * candidates.length)];
  if (chosen === undefined) {
    return typeMoveFailed(caster.id, context.move);
  }
  return applyTypeOverride(caster, [chosen], TypeChangeReason.ConversionResist);
}
