/**
 * A deterministic "survive at 1 HP" effect shielding a target from an otherwise lethal hit — the
 * things that make a raw damage-vs-HP K.O. verdict lie (plan 175).
 *
 * Probabilistic survivals (Bandeau / `focus-band`) are deliberately NOT listed: qualifying every
 * verdict with a coin flip that usually fails would make the preview useless.
 */
export const SurvivalGuardKind = {
  /** Ténacité — the target spent its action bracing; survives any hit this turn. */
  Endure: "endure",
  /** Fermeté — ability, survives a lethal hit taken from full HP. */
  Sturdy: "sturdy",
  /** Ceinture Force — held item, survives a lethal hit taken from full HP, once. */
  FocusSash: "focus-sash",
} as const;

export type SurvivalGuardKind = (typeof SurvivalGuardKind)[keyof typeof SurvivalGuardKind];
