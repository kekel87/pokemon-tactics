export const LinkType = {
  LeechSeed: "leech_seed",
} as const;

export type LinkType = (typeof LinkType)[keyof typeof LinkType];
