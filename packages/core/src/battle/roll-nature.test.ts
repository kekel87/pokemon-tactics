import { describe, expect, it } from "vitest";
import { Nature } from "../enums/nature";
import { rollNature } from "./roll-nature";

describe("rollNature", () => {
  it("returns first nature when rng = 0", () => {
    expect(rollNature(() => 0)).toBe(Nature.Hardy);
  });

  it("returns last nature when rng ~ 1", () => {
    expect(rollNature(() => 0.999)).toBe(Nature.Quirky);
  });

  it("returns mid nature for rng = 0.5", () => {
    // 0.5 * 25 = 12.5 → floor 12 → Serious
    expect(rollNature(() => 0.5)).toBe(Nature.Serious);
  });

  it("clamps oversized rng values to last index", () => {
    expect(rollNature(() => 1.5)).toBe(Nature.Quirky);
  });

  it("approximates uniform distribution over 1000 rolls", () => {
    const rng = mulberry32(1234);
    const counts = new Map<Nature, number>();
    for (let i = 0; i < 1000; i += 1) {
      const nature = rollNature(rng);
      counts.set(nature, (counts.get(nature) ?? 0) + 1);
    }
    expect(counts.size).toBe(25);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(20);
      expect(count).toBeLessThan(70);
    }
  });
});

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
