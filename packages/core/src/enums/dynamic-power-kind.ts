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
} as const;

export type DynamicPowerKind = (typeof DynamicPowerKind)[keyof typeof DynamicPowerKind];
