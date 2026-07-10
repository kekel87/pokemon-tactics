import { BattleEventType } from "../../../enums/battle-event-type";
import type { EffectKind } from "../../../enums/effect-kind";
import type { BattleEvent } from "../../../types/battle-event";
import type { Effect } from "../../../types/effect";
import type { EffectContext } from "../../effect-handler-registry";

/**
 * Vol Magnétik (magnet-rise, plan 154): the caster levitates for `turns` (temporary effectively-flying
 * via `magnetRiseTurns`, consulted in `isEffectivelyFlying`). Fails if the caster is already levitating
 * or is grounded by Anti-Air (`smackedDown`). The Gravité-zone cast block is enforced upstream by the
 * move's `disabledUnderGravity` flag.
 */
export function handleMagnetRise(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.MagnetRise }>;
  const caster = context.attacker;

  if (caster.smackedDown === true || (caster.magnetRiseTurns ?? 0) > 0) {
    return [{ type: BattleEventType.MoveFailed, attackerId: caster.id, moveId: context.move.id }];
  }

  caster.magnetRiseTurns = effect.turns;
  return [{ type: BattleEventType.MagnetRisePosted, pokemonId: caster.id, turns: effect.turns }];
}
