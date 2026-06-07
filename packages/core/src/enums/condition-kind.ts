/**
 * Gates a (secondary) effect on a battle-state predicate evaluated at application time.
 * Extensible: future conditional effects add a variant here and a check in the effect handler.
 */
export const ConditionKind = {
  /**
   * The target holds a stat boost it has not yet "cashed in" by acting
   * (`PokemonInstance.hasFreshStatBoost`). Drives Alluring Voice (confusion) and
   * Burning Jealousy (burn) — the CT-equivalent of Showdown's `statsRaisedThisTurn`.
   */
  TargetBoostedRecently: "target_boosted_recently",
  /** The target is on the caster's team (pollen-puff heal branch). */
  TargetIsAlly: "target_is_ally",
  /** The target is on an opposing team (pollen-puff damage branch). */
  TargetIsEnemy: "target_is_enemy",
} as const;

export type ConditionKind = (typeof ConditionKind)[keyof typeof ConditionKind];
