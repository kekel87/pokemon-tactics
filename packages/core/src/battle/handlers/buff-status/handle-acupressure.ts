import { BattleEventType } from "../../../enums/battle-event-type";
import type { EffectKind } from "../../../enums/effect-kind";
import { EffectTarget } from "../../../enums/effect-target";
import { StatName } from "../../../enums/stat-name";
import type { BattleEvent } from "../../../types/battle-event";
import type { Effect } from "../../../types/effect";
import { applyStatStage } from "../../apply-stat-stage";
import type { EffectContext } from "../../effect-handler-registry";

/** Battle stats eligible for the random boost — Accuracy/Evasion excluded (plan 154 §D3). */
const BATTLE_STATS: StatName[] = [
  StatName.Attack,
  StatName.Defense,
  StatName.SpAttack,
  StatName.SpDefense,
  StatName.Speed,
];

/**
 * Acupression (acupressure, plan 154): +`stages` to one random battle stat of the resolved target
 * (self or an adjacent ally). Only stats below the +6 cap are eligible; the move fails if all are maxed.
 */
export function handleAcupressure(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.RaiseRandomStat }>;
  // Ally-or-self targeting: the engine's target list excludes the caster's own tile, so a self-cast
  // arrives with an empty `targets` — fall back to the caster.
  const target =
    effect.target === EffectTarget.Self
      ? context.attacker
      : (context.targets[0] ?? context.attacker);

  const eligible = BATTLE_STATS.filter((stat) => target.statStages[stat] < 6);
  if (eligible.length === 0) {
    return [
      {
        type: BattleEventType.MoveFailed,
        attackerId: context.attacker.id,
        moveId: context.move.id,
      },
    ];
  }

  const stat = eligible[Math.floor(context.random() * eligible.length)];
  if (stat === undefined) {
    return [
      {
        type: BattleEventType.MoveFailed,
        attackerId: context.attacker.id,
        moveId: context.move.id,
      },
    ];
  }
  return applyStatStage(target, stat, effect.stages).events;
}
