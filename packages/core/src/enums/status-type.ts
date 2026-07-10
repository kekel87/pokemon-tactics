export const StatusType = {
  Burned: "burned",
  Paralyzed: "paralyzed",
  Poisoned: "poisoned",
  BadlyPoisoned: "badly_poisoned",
  Frozen: "frozen",
  Asleep: "asleep",
  Confused: "confused",
  Seeded: "seeded",
  Trapped: "trapped",
  Intimidated: "intimidated",
  Infatuated: "infatuated",
  LockedOn: "locked-on",
  Roosted: "roosted",
  Flinch: "flinch",
  Taunted: "taunted",
  Disabled: "disabled",
  Encored: "encored",
  /** Charge volatile: the user's next Electric move is doubled (B3). */
  Charged: "charged",
  /** Ingrain volatile (B2): heals 1/8 HP/turn if the mon did not move; grounds it. Persistent. */
  Ingrain: "ingrain",
  /** Aqua Ring volatile (B2): heals 1/16 HP/turn unconditionally. Persistent. */
  AquaRing: "aqua-ring",
  /**
   * Imprison ("Possessif") volatile: persistent on the caster (no timer). While alive, enemies
   * cannot use any move the caster also knows. Dies with the caster (handleKo clears volatiles).
   */
  Imprisoning: "imprisoning",
  /** Heal Block ("Anti-Soin") volatile: 2 turns, blocks using heal moves and receiving any heal. */
  HealBlocked: "heal-blocked",
  /**
   * Lien du Destin (destiny-bond) volatile: set on the caster until its next turn. If the caster is
   * KO'd while it holds, the Pokémon that dealt the killing blow faints too.
   */
  DestinyBond: "destiny-bond",
  /**
   * Rancune (grudge) volatile: set on the caster until its next turn. If the caster is KO'd by a move,
   * that move is permanently locked (unusable) on its attacker for the rest of the battle.
   */
  Grudge: "grudge",
  /**
   * Malédiction (curse, plan 154) DoT volatile posted by a Ghost caster. Persistent (`remainingTurns
   * -1`), inflicts `damagePerTurn` (25% max HP) each end-turn via `cursed-tick-handler`. Not position-
   * linked — the source may die/leave without breaking it (fire-and-forget, distinct from Vampigraine).
   */
  Cursed: "cursed",
} as const;

export type StatusType = (typeof StatusType)[keyof typeof StatusType];
