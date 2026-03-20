export const StatName = {
  Hp: "hp",
  Attack: "attack",
  Defense: "defense",
  SpAttack: "spAttack",
  SpDefense: "spDefense",
  Speed: "speed",
} as const;

export type StatName = (typeof StatName)[keyof typeof StatName];
