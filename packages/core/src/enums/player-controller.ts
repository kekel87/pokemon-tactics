export const PlayerController = {
  Human: "human",
  Ai: "ai",
} as const;

export type PlayerController = (typeof PlayerController)[keyof typeof PlayerController];
