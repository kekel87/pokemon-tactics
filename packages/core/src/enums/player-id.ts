export const PlayerId = {
  Player1: "player-1",
  Player2: "player-2",
} as const;

export type PlayerId = (typeof PlayerId)[keyof typeof PlayerId];
