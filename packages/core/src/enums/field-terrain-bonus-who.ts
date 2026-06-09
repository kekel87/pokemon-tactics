/**
 * Which combatant's position gates a {@link MoveDefinition.fieldTerrainPowerBonus}:
 * the caster (Misty Explosion, Expanding Force) or the target (Rising Voltage).
 */
export const FieldTerrainBonusWho = {
  Caster: "caster",
  Target: "target",
} as const;

export type FieldTerrainBonusWho =
  (typeof FieldTerrainBonusWho)[keyof typeof FieldTerrainBonusWho];
