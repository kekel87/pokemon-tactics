/**
 * Reactive-charge behaviour for the "charge + interrupt/react if hit" family (plan 150):
 * Mitra-Poing (focus), Bec-Canon (beak), Carapiège (shell). A two-turn charge move sets its
 * `chargeReaction` so the damage pipeline knows how to react when the (still vulnerable) charging
 * user is struck during its wait window.
 *
 * - `Focus`  — any direct damage the user takes cancels the T2 strike (`focusInterrupted`).
 * - `Beak`   — a contact attacker is burned; the strike still fires on T2.
 * - `Shell`  — the trap arms only if hit by a physical move (`shellTrapArmed`); else the T2 strike fails.
 */
export const ChargeReaction = {
  Focus: "focus",
  Beak: "beak",
  Shell: "shell",
} as const;

export type ChargeReaction = (typeof ChargeReaction)[keyof typeof ChargeReaction];
