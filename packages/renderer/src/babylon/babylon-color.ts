import { Color3 } from "@babylonjs/core/Maths/math.color";

/** `0xrrggbb` (renderer `constants.ts` palette) → Babylon `Color3`. */
export function hexToColor3(hex: number): Color3 {
  return Color3.FromHexString(`#${hex.toString(16).padStart(6, "0")}`);
}

/** `0xrrggbb` → CSS `#rrggbb`, for DOM overlay elements coloured from the same palette. */
export function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}
