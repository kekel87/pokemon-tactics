export const Direction = {
  North: "north",
  South: "south",
  East: "east",
  West: "west",
} as const;

export type Direction = (typeof Direction)[keyof typeof Direction];
