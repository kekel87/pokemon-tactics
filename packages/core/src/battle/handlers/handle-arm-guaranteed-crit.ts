import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";

/**
 * Affilage (laser-focus): arm a one-shot guaranteed critical hit on the caster. The flag is read in
 * the damage calc (forces `isCrit`) and consumed at the end of the caster's next completed action
 * (BattleEngine). Distinct from `critStageBoost` (Puissance): it does not stack a crit stage, it
 * guarantees the very next offensive move regardless of stage.
 */
export function handleArmGuaranteedCrit(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  caster.guaranteedCritArmed = true;
  return [{ type: BattleEventType.GuaranteedCritArmed, pokemonId: caster.id }];
}
