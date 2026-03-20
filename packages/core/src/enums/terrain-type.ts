export const TerrainType = {
  Normal: "normal",
  Lava: "lava",
  Water: "water",
  TallGrass: "tall_grass",
  Ice: "ice",
} as const;

export type TerrainType = (typeof TerrainType)[keyof typeof TerrainType];
