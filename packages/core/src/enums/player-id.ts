export const PlayerId = {
  Player1: "player-1",
  Player2: "player-2",
  Player3: "player-3",
  Player4: "player-4",
  Player5: "player-5",
  Player6: "player-6",
  Player7: "player-7",
  Player8: "player-8",
  Player9: "player-9",
  Player10: "player-10",
  Player11: "player-11",
  Player12: "player-12",
} as const;

export type PlayerId = (typeof PlayerId)[keyof typeof PlayerId];
