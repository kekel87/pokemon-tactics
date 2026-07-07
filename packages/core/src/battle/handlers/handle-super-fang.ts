import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import type { EffectContext } from "../effect-handler-registry";

/**
 * Croc Fatal (super-fang): deals fixed damage equal to half the target's current HP (min 1). Pure HP
 * write — no crit, no STAB, no type chart (mirrors Effort / endeavor), so it touches Ghosts and
 * ignores the target's defenses. The `max(1, …)` means it CAN KO a target already at 1-2 HP. Like the
 * other non-damage HP-write effects in this engine (Effort, Balance), it is NOT gated by Protection —
 * `checkDefense` only runs on the `Damage` effect path, which this move does not use.
 */
export function handleSuperFang(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const target = context.targets[0];
  if (!target || target.currentHp <= 0) {
    return [];
  }
  const damage = Math.max(1, Math.floor(target.currentHp / 2));
  target.currentHp = Math.max(0, target.currentHp - damage);
  return [
    {
      type: BattleEventType.SuperFangApplied,
      attackerId: caster.id,
      targetId: target.id,
      damage,
    },
  ];
}
