export const AttackStatSource = {
  /** Use the user's Defense stat + Defense stages instead of Attack (body-press). */
  UserDefense: "user_defense",
  /** Use the target's Attack stat + Attack stages instead of the user's Attack (foul-play). */
  TargetAttack: "target_attack",
} as const;

export type AttackStatSource = (typeof AttackStatSource)[keyof typeof AttackStatSource];
