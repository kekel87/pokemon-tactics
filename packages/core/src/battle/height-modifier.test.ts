import { describe, expect, it } from "vitest";
import { getHeightModifier, heightBlocks, isMeleeBlockedByHeight } from "./height-modifier";

describe("getHeightModifier", () => {
  it("returns 1.0 for same height", () => {
    expect(getHeightModifier(1, 1, false)).toBe(1.0);
  });

  it("returns 1.1 for +1 height advantage", () => {
    expect(getHeightModifier(2, 1, false)).toBeCloseTo(1.1);
  });

  it("returns 1.2 for +2 height advantage", () => {
    expect(getHeightModifier(3, 1, false)).toBeCloseTo(1.2);
  });

  it("returns 1.5 (capped) for +5 height advantage", () => {
    expect(getHeightModifier(6, 1, false)).toBeCloseTo(1.5);
  });

  it("caps at 1.5 for +10 height advantage", () => {
    expect(getHeightModifier(11, 1, false)).toBeCloseTo(1.5);
  });

  it("returns 0.9 for -1 height disadvantage", () => {
    expect(getHeightModifier(1, 2, false)).toBeCloseTo(0.9);
  });

  it("returns 0.7 (capped) for -3 height disadvantage", () => {
    expect(getHeightModifier(1, 4, false)).toBeCloseTo(0.7);
  });

  it("caps at 0.7 for -5 height disadvantage", () => {
    expect(getHeightModifier(1, 6, false)).toBeCloseTo(0.7);
  });

  it("returns 1.0 when ignoresHeight is true", () => {
    expect(getHeightModifier(5, 1, true)).toBe(1.0);
  });

  it("handles half-tile differences (+0.5 → 1.05)", () => {
    expect(getHeightModifier(1.5, 1, false)).toBeCloseTo(1.05);
  });
});

describe("isMeleeBlockedByHeight", () => {
  it("blocks melee at height diff 2", () => {
    expect(isMeleeBlockedByHeight(0, 2, 1)).toBe(true);
  });

  it("blocks melee at height diff 3", () => {
    expect(isMeleeBlockedByHeight(0, 3, 1)).toBe(true);
  });

  it("allows melee at height diff 1.5", () => {
    expect(isMeleeBlockedByHeight(0, 1.5, 1)).toBe(false);
  });

  it("allows melee at height diff 1", () => {
    expect(isMeleeBlockedByHeight(0, 1, 1)).toBe(false);
  });

  it("allows melee at same height", () => {
    expect(isMeleeBlockedByHeight(1, 1, 1)).toBe(false);
  });

  it("does not block ranged attacks at height diff 3", () => {
    expect(isMeleeBlockedByHeight(0, 3, 2)).toBe(false);
  });

  it("does not block ranged attacks at height diff 5", () => {
    expect(isMeleeBlockedByHeight(0, 5, 3)).toBe(false);
  });

  it("blocks melee when attacker is higher by 2", () => {
    expect(isMeleeBlockedByHeight(3, 1, 1)).toBe(true);
  });
});

describe("heightBlocks", () => {
  it("returns false when obstacle and reference are at same height", () => {
    expect(heightBlocks(0, 0)).toBe(false);
    expect(heightBlocks(1, 1)).toBe(false);
  });

  it("returns false when obstacle is exactly reference + 1 (threshold passes)", () => {
    expect(heightBlocks(1, 0)).toBe(false);
    expect(heightBlocks(3, 2)).toBe(false);
  });

  it("returns true when obstacle exceeds reference + 1", () => {
    expect(heightBlocks(2, 0)).toBe(true);
    expect(heightBlocks(3, 1)).toBe(true);
    expect(heightBlocks(4, 2)).toBe(true);
  });

  it("returns false when obstacle is below the reference", () => {
    expect(heightBlocks(0, 2)).toBe(false);
    expect(heightBlocks(1, 5)).toBe(false);
  });

  it("handles fractional heights on the strict >= threshold", () => {
    expect(heightBlocks(1.5, 0.5)).toBe(false);
    expect(heightBlocks(1.6, 0.5)).toBe(true);
  });
});
