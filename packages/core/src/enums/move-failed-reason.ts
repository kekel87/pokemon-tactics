/**
 * Why a move fizzled after being committed (plan 150). Carried on the `MoveFailed` event so the log
 * can explain the failure. Mirrors the other event `reason` enums (ProtectionReason, StatusImmuneReason…).
 *
 * - `Focus`    — a charging Mitra-Poing (focus-punch) was struck and lost its focus.
 * - `ShellTrap` — a Carapiège (shell-trap) was never armed by a physical hit.
 */
export const MoveFailedReason = {
  Focus: "focus",
  ShellTrap: "shell-trap",
} as const;

export type MoveFailedReason = (typeof MoveFailedReason)[keyof typeof MoveFailedReason];
