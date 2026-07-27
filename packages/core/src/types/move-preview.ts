import type { OhkoImmunity } from "../battle/ohko";
import type { SurvivalGuardKind } from "../enums/survival-guard-kind";
import type { DamageEstimate } from "./damage-estimate";

/**
 * Everything the combat preview panel (plan 175) needs about one attacker→target pair, resolved in
 * a single call so the view layer never has to stitch three core APIs together.
 *
 * Purely descriptive: computing it rolls nothing and mutates nothing (notably, it does not consume
 * Verrouillage), so it can be recomputed freely while the player cycles targets.
 */
export interface MovePreview {
  /**
   * Damage range and the multipliers that produced it. A zero range is NOT collapsed to null: the
   * view needs `effectiveness` to tell an immunity (×0) apart from a status move that simply deals
   * nothing. Null only when the pair could not be estimated at all.
   */
  readonly damage: DamageEstimate | null;
  /** Effective hit chance in percent; `null` means the move cannot miss. */
  readonly accuracy: number | null;
  /** Crit probability 0-1. Exactly 0 = crit-immune target, exactly 1 = forced crit. */
  readonly critChance: number;
  /**
   * A deterministic effect that would leave the target at 1 HP instead of K.O., if one is active
   * AND relevant (Fermeté / Ceinture Force only count from full HP). Null when nothing would save
   * the target. The view decides whether the player is allowed to KNOW about it.
   */
  readonly survivalGuard: SurvivalGuardKind | null;
  /**
   * One-hit-KO move (Abîme, Guillotine, Empal'Korne, Glaciation). Their damage range is meaningless
   * — they either kill outright or do nothing — so the view must read this instead of `damage`.
   */
  readonly isOhko: boolean;
  /**
   * Why the target is flat-out immune to this OHKO move, if it is. Note Fermeté grants TOTAL
   * immunity here, not the survive-at-1-HP of `survivalGuard`.
   */
  readonly ohkoImmunity: OhkoImmunity | null;
}
