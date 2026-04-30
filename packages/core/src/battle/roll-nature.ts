import { Nature } from "../enums/nature";

const ALL_NATURES: readonly Nature[] = Object.values(Nature);

export function rollNature(rng: () => number): Nature {
  const index = Math.floor(rng() * ALL_NATURES.length);
  const safeIndex = Math.min(Math.max(index, 0), ALL_NATURES.length - 1);
  return ALL_NATURES[safeIndex] ?? Nature.Hardy;
}
