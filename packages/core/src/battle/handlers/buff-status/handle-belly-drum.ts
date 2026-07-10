import { BattleEventType } from "../../../enums/battle-event-type";
import type { EffectKind } from "../../../enums/effect-kind";
import { StatName } from "../../../enums/stat-name";
import type { BattleEvent } from "../../../types/battle-event";
import type { Effect } from "../../../types/effect";
import { applyStatStage } from "../../apply-stat-stage";
import type { EffectContext } from "../../effect-handler-registry";

const MAX_STAGE = 6;

/**
 * Cognobidon (belly-drum, plan 154): the caster sacrifices `hpCostFraction` of its max HP to maximise
 * its Attack (stages → +6). Fails if the HP cost would down the caster or if Attack is already maxed.
 */
export function handleBellyDrum(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.BellyDrum }>;
  const caster = context.attacker;
  const cost = Math.floor(caster.maxHp * effect.hpCostFraction);

  if (caster.currentHp <= cost || caster.statStages[StatName.Attack] >= MAX_STAGE) {
    return [{ type: BattleEventType.MoveFailed, attackerId: caster.id, moveId: context.move.id }];
  }

  caster.currentHp -= cost;
  const delta = MAX_STAGE - caster.statStages[StatName.Attack];
  const { events } = applyStatStage(caster, StatName.Attack, delta);

  return [{ type: BattleEventType.BellyDrumUsed, pokemonId: caster.id, hpLost: cost }, ...events];
}
