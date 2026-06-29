import { BattleEventType } from "../../../enums/battle-event-type";
import type { BattleEvent } from "../../../types/battle-event";
import type { EffectContext } from "../../effect-handler-registry";

/**
 * Copie (mimic) / Gribouille (sketch): replace the source move's slot on the caster with the
 * target's last used move, for the rest of the battle. (No PP system in this game — the slot id swap
 * is the whole effect; the copied move's stats drive its own future Charge-Time cost.) Fails when the
 * target has not used any move yet. With no resolved target (missed / out of range) the move is a
 * no-op (the miss is already reported by the engine).
 */
export function handleCopyMoveToSlot(context: EffectContext): BattleEvent[] {
  const caster = context.attacker;
  const target = context.targets[0];
  if (target === undefined) {
    return [];
  }

  const copiedMoveId = target.lastUsedMoveId;
  if (copiedMoveId === undefined) {
    return [
      { type: BattleEventType.MoveCopyFailed, pokemonId: caster.id, moveId: context.move.id },
    ];
  }

  const slotIndex = caster.moveIds.indexOf(context.move.id);
  if (slotIndex === -1) {
    return [
      { type: BattleEventType.MoveCopyFailed, pokemonId: caster.id, moveId: context.move.id },
    ];
  }

  caster.moveIds[slotIndex] = copiedMoveId;
  return [
    {
      type: BattleEventType.MoveCopied,
      pokemonId: caster.id,
      slotMoveId: context.move.id,
      copiedMoveId,
    },
  ];
}
