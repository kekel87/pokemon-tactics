export const Category = {
  Physical: "physical",
  Special: "special",
  Status: "status",
} as const;

export type Category = (typeof Category)[keyof typeof Category];
