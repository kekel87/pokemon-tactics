import { BattleEventType } from "../enums/battle-event-type";
import { Category } from "../enums/category";
import { ChargeReaction } from "../enums/charge-reaction";
import { PokemonType } from "../enums/pokemon-type";
import { StatusType } from "../enums/status-type";
import type { BattleEvent } from "../types/battle-event";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import { isMajorStatus } from "./stat-modifier";

export interface ChargeReactionInput {
  /** The mon currently charging a reactive move that just took a hit (`damage > 0`). */
  victim: PokemonInstance;
  /** The mon that struck the victim. */
  attacker: PokemonInstance;
  /** The move the attacker used (drives the contact / physical checks). */
  attackerMove: MoveDefinition;
  /** The attacker's effective types (burn immunity for Bec-Canon). */
  attackerTypes: readonly PokemonType[];
}

/**
 * React to a charging mon being struck during its wait window (plan 150). Mutates `victim` /
 * `attacker` as needed and returns the events to emit. No-op unless the victim is charging a move
 * that carries a `chargeReaction`. Called from `handle-damage` AFTER the hit lands (`damage > 0`,
 * so after defenses/Substitute/immunity) and BEFORE any KO resolution.
 *
 * - `Focus` (Mitra-Poing): any direct damage cancels the T2 strike (`focusInterrupted`). Idempotent
 *   across a multi-hit move (only the first hit emits the event).
 * - `Beak` (Bec-Canon): a contact attacker with no major status and no Fire-type immunity is burned.
 *   The charge is NOT interrupted — the strike still fires on T2.
 * - `Shell` (Carapiège): a physical hit arms the trap (`shellTrapArmed`), enabling the T2 strike.
 */
export function applyChargeReaction(input: ChargeReactionInput): BattleEvent[] {
  const { victim, attacker, attackerMove, attackerTypes } = input;
  const reaction = victim.chargingMove?.reaction;
  if (reaction === undefined) {
    return [];
  }

  if (reaction === ChargeReaction.Focus) {
    if (victim.focusInterrupted === true) {
      return [];
    }
    victim.focusInterrupted = true;
    return [
      {
        type: BattleEventType.FocusInterrupted,
        pokemonId: victim.id,
        moveId: victim.chargingMove?.moveId ?? "",
      },
    ];
  }

  if (reaction === ChargeReaction.Beak) {
    if (attackerMove.flags?.contact !== true) {
      return [];
    }
    // Same burn immunity as a standard burn: Fire-types are immune, and a mon that already carries a
    // major status can't be burned on top.
    if (attackerTypes.includes(PokemonType.Fire)) {
      return [];
    }
    if (attacker.statusEffects.some((status) => isMajorStatus(status.type))) {
      return [];
    }
    attacker.statusEffects.push({ type: StatusType.Burned, remainingTurns: null });
    return [{ type: BattleEventType.BeakBlastBurn, pokemonId: victim.id, targetId: attacker.id }];
  }

  // Shell (Carapiège): a physical hit arms the trap; a special hit leaves it disarmed.
  if (attackerMove.category === Category.Physical) {
    if (victim.shellTrapArmed === true) {
      return [];
    }
    victim.shellTrapArmed = true;
    return [{ type: BattleEventType.ShellTrapArmed, pokemonId: victim.id }];
  }
  return [];
}
