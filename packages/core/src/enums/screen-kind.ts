export const ScreenKind = {
  Reflect: "reflect",
  LightScreen: "light-screen",
} as const;

export type ScreenKind = (typeof ScreenKind)[keyof typeof ScreenKind];
