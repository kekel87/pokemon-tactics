export const AiDifficulty = {
  Easy: "easy",
  Medium: "medium",
  Hard: "hard",
} as const;

export type AiDifficulty = (typeof AiDifficulty)[keyof typeof AiDifficulty];
