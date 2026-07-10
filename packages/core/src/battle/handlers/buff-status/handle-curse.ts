import { BattleEventType } from "../../../enums/battle-event-type";
import type { EffectKind } from "../../../enums/effect-kind";
import { PokemonType } from "../../../enums/pokemon-type";
import { StatusType } from "../../../enums/status-type";
import type { BattleEvent } from "../../../types/battle-event";
import type { Effect } from "../../../types/effect";
import { applyStatStage } from "../../apply-stat-stage";
import type { EffectContext } from "../../effect-handler-registry";

/**
 * Malédiction (curse, plan 154): dual behaviour driven by the CASTER's effective type.
 * - Ghost caster: sacrifice `hpCostFraction` of its max HP, then post a persistent Cursed DoT
 *   (`dotFraction`/turn) on an adjacent enemy. Fails (no self-KO) if the HP cost would down the caster.
 * - Non-Ghost caster: self stat buff (`nonGhostStats` = −1 Spe / +1 Atk / +1 Def), no HP cost.
 * The effective targeting is resolved upstream (`effectiveTargetingFor`) so the Ghost branch already
 * receives an enemy target and the non-Ghost branch resolves to the caster's own tile.
 */
export function handleCurse(context: EffectContext): BattleEvent[] {
  const effect = context.effect as Extract<Effect, { kind: typeof EffectKind.Curse }>;
  const caster = context.attacker;
  const isGhost = context.attackerTypes.includes(PokemonType.Ghost);

  if (!isGhost) {
    const events: BattleEvent[] = [];
    for (const { stat, stages } of effect.nonGhostStats) {
      events.push(...applyStatStage(caster, stat, stages).events);
    }
    return events;
  }

  const target = context.targets.find((candidate) => candidate.id !== caster.id);
  const cost = Math.floor(caster.maxHp * effect.hpCostFraction);
  if (!target || caster.currentHp <= cost) {
    return [{ type: BattleEventType.MoveFailed, attackerId: caster.id, moveId: context.move.id }];
  }

  if (target.volatileStatuses.some((volatile) => volatile.type === StatusType.Cursed)) {
    return [{ type: BattleEventType.MoveFailed, attackerId: caster.id, moveId: context.move.id }];
  }

  caster.currentHp -= cost;
  target.volatileStatuses.push({
    type: StatusType.Cursed,
    remainingTurns: -1,
    damagePerTurn: effect.dotFraction,
    sourceId: caster.id,
  });

  return [{ type: BattleEventType.Cursed, casterId: caster.id, targetId: target.id, hpLost: cost }];
}
