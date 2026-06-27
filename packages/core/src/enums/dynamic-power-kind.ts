export const DynamicPowerKind = {
  /** ×2 if the user has a major status (facade). */
  SelfStatusDouble: "self_status_double",
  /** ×2 if the target has any major status (hex). */
  TargetStatusDouble: "target_status_double",
  /** ×2 if the target is poisoned or badly poisoned (venoshock). */
  TargetPoisonedDouble: "target_poisoned_double",
  /** ×2 if the user holds no item (acrobatics). */
  NoHeldItemDouble: "no_held_item_double",
  /** 20 + 20 × sum of the user's positive stat stages (stored-power). */
  StoredPower: "stored_power",
  /** Power scales with user/target speed ratio (electro-ball). */
  SpeedRatio: "speed_ratio",
  /** Power scales with target/user speed ratio (gyro-ball). */
  SpeedRatioInverse: "speed_ratio_inverse",
  /** Power scales with the user's low HP fraction (flail, reversal). */
  LowHpSelf: "low_hp_self",
  /** ×2 if the target is at or below half HP (brine). */
  TargetHpHalfDouble: "target_hp_half_double",
  /** Power scales linearly with the target's current HP fraction (hard-press). */
  TargetHpScaled: "target_hp_scaled",
  /** Power scales linearly with the user's current HP fraction (water-spout). */
  SelfHpScaled: "self_hp_scaled",
  /** Power scales with the target's body weight (low-kick, grass-knot). */
  TargetWeight: "target_weight",
  /** Power scales with the target/user weight ratio (heavy-slam, heat-crash). */
  WeightRatio: "weight_ratio",
  /** ×2 if the user took enemy damage since its last action (avalanche, revenge). */
  DamagedByEnemySinceLastAction: "damaged_by_enemy_since_last_action",
  /** ×2 if the target took any damage since its last action (assurance). */
  TargetDamagedSinceLastAction: "target_damaged_since_last_action",
  /** move.power + 50 × min(6, user timesHit) — capped at 350 (rage-fist). */
  TimesHitScaled: "times_hit_scaled",
  /** ×2 if an ally fainted since the user's last action (retaliate). */
  AllyFaintedSinceLastAction: "ally_fainted_since_last_action",
  /** ×2 if the user's previous resolved move failed (stomping-tantrum). */
  PreviousMoveFailedDouble: "previous_move_failed_double",
  /** 40 × echoStreak, capped at 200 — team crescendo (echoed-voice). */
  EchoCrescendo: "echo_crescendo",
  /** ×2 if the team's previous action used this same move (round). */
  TeamPreviousMoveDouble: "team_previous_move_double",
  /** 30 × 2^(streak-1), capped at 480 — rolls harder each consecutive cast (rollout). */
  RolloutStreak: "rollout_streak",
  /** move.power × (1 + number of fainted allies) — grows as the team falls (last-respects). */
  AllyFaintCountScaled: "ally_faint_count_scaled",
  /** ×2 if the target has not acted since the user's last action (fishious-rend, bolt-beak). */
  TargetIdleSinceLastAction: "target_idle_since_last_action",
  /** Power = the user's held item's fling power (Dégommage / fling). */
  HeldItemFling: "held_item_fling",
} as const;

export type DynamicPowerKind = (typeof DynamicPowerKind)[keyof typeof DynamicPowerKind];
