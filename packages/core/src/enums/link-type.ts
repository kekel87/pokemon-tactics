export const LinkType = {
  LeechSeed: "leech_seed",
  Bind: "bind",
} as const;

export type LinkType = (typeof LinkType)[keyof typeof LinkType];
