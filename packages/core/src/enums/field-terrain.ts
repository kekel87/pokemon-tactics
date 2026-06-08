/**
 * Field terrains ("Champs") — Pokemon terrain effects (B4). Distinct from {@link TerrainType},
 * which describes static map tiles (tall grass, lava, ...). A field terrain is painted as a zone
 * on the grid by a setter move and affects grounded mons standing inside it.
 */
export const FieldTerrain = {
  Grassy: "grassy",
  Electric: "electric",
  Misty: "misty",
  Psychic: "psychic",
} as const;

export type FieldTerrain = (typeof FieldTerrain)[keyof typeof FieldTerrain];
