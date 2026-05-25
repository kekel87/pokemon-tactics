export const AuraKind = {
  Reflect: "reflect",
  LightScreen: "light-screen",
  Mist: "mist",
  Safeguard: "safeguard",
} as const;

export type AuraKind = (typeof AuraKind)[keyof typeof AuraKind];
