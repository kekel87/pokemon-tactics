import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";

/**
 * Balance (pain-split): pools the caster's and target's current HP and splits it evenly. Both end at
 * `floor((casterHp + targetHp) / 2)`, each clamped to its own max HP. The lower-HP mon heals, the
 * higher-HP mon is chipped — never above max, never a KO on its own (the floor of an average of two
 * living mons is ≥ 1). Single-target; blocked upstream by Protection (move `protect` flag).
 */
export function handlePainSplit(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const target = context.targets[0];
  if (!target) {
    return [];
  }
  const pooled = Math.floor((caster.currentHp + target.currentHp) / 2);
  caster.currentHp = Math.min(caster.maxHp, pooled);
  target.currentHp = Math.min(target.maxHp, pooled);
  return [
    {
      type: BattleEventType.PainSplitApplied,
      casterId: caster.id,
      targetId: target.id,
      pooledHp: pooled,
    },
  ];
}
