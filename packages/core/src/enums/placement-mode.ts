export const PlacementMode = {
  Alternating: "alternating",
  Random: "random",
} as const;

export type PlacementMode = (typeof PlacementMode)[keyof typeof PlacementMode];
