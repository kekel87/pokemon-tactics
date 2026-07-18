import { BattleEventType } from "../../../enums/battle-event-type";
import type { BattleEvent } from "../../../types/battle-event";
import type { EffectContext } from "../../effect-handler-registry";
import { effectiveCombatStats } from "../../effective-combat-stats";
import { statManipBlockedBySubstitute } from "../../substitute-system";

/**
 * Partage Garde (guard-split, plan 162): average the caster's and target's effective Defense and
 * Sp. Def, then pin both mons' raw defensive stats to that average via the by-instance override
 * (`defenseStatOverride` / `spDefenseStatOverride`). Faithful to canon (raw-stat averaging, stat
 * stages still apply on top in the damage calc). Blocked by the target's Substitute.
 */
export function handleGuardSplit(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const target = context.targets[0];
  if (!target || statManipBlockedBySubstitute(caster, target)) {
    return [];
  }

  const casterStats = effectiveCombatStats(caster);
  const targetStats = effectiveCombatStats(target);
  const defense = Math.floor((casterStats.defense + targetStats.defense) / 2);
  const spDefense = Math.floor((casterStats.spDefense + targetStats.spDefense) / 2);

  caster.defenseStatOverride = defense;
  caster.spDefenseStatOverride = spDefense;
  target.defenseStatOverride = defense;
  target.spDefenseStatOverride = spDefense;

  return [
    {
      type: BattleEventType.GuardSplit,
      casterId: caster.id,
      targetId: target.id,
      defense,
      spDefense,
    },
  ];
}
