export const TerrainType = {
  Normal: "normal",
  TallGrass: "tall_grass",
  Obstacle: "obstacle",
  Water: "water",
  DeepWater: "deep_water",
  Magma: "magma",
  Lava: "lava",
  Ice: "ice",
  Sand: "sand",
  Snow: "snow",
  Swamp: "swamp",
} as const;

export type TerrainType = (typeof TerrainType)[keyof typeof TerrainType];

const IMPASSABLE_TERRAINS: ReadonlySet<TerrainType> = new Set([
  TerrainType.Obstacle,
  TerrainType.DeepWater,
  TerrainType.Lava,
]);

export function isTerrainPassable(terrain: TerrainType): boolean {
  return !IMPASSABLE_TERRAINS.has(terrain);
}
