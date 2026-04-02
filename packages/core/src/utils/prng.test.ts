import { describe, expect, it } from "vitest";
import { createPrng } from "./prng";

describe("createPrng", () => {
  it("returns values between 0 and 1", () => {
    const random = createPrng(42);
    for (let i = 0; i < 100; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("is deterministic — same seed produces same sequence", () => {
    const random1 = createPrng(42);
    const random2 = createPrng(42);
    for (let i = 0; i < 50; i++) {
      expect(random1()).toBe(random2());
    }
  });

  it("different seeds produce different sequences", () => {
    const random1 = createPrng(42);
    const random2 = createPrng(99);
    const allSame = Array.from({ length: 10 }, () => random1() === random2()).every(Boolean);
    expect(allSame).toBe(false);
  });

  it("produces uniform-ish distribution", () => {
    const random = createPrng(12345);
    let belowHalf = 0;
    const total = 1000;
    for (let i = 0; i < total; i++) {
      if (random() < 0.5) belowHalf++;
    }
    expect(belowHalf).toBeGreaterThan(400);
    expect(belowHalf).toBeLessThan(600);
  });
});
