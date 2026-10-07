import { describe, expect, it } from "vitest";
import {
  animationTotalDurationMs,
  frameDurationMs,
  indexAtlasDurations,
  indexAtlasHitFrames,
  type SpriteFrameTiming,
} from "./sprite-atlas.js";

const TIMING: SpriteFrameTiming = { tickMs: 33, defaultTicks: 4, fallbackMs: 140 };

describe("indexAtlasDurations", () => {
  it("Given animations with durations, keys them by name", () => {
    const result = indexAtlasDurations({ Walk: { durations: [2, 3] }, Idle: { durations: [8] } });
    expect(result.get("Walk")).toEqual([2, 3]);
    expect(result.get("Idle")).toEqual([8]);
  });

  it("Given missing or empty durations, drops the entry", () => {
    const result = indexAtlasDurations({ Walk: {}, Idle: { durations: [] } });
    expect(result.size).toBe(0);
  });

  it("Given no animations, returns an empty map", () => {
    expect(indexAtlasDurations(undefined).size).toBe(0);
  });
});

describe("indexAtlasHitFrames", () => {
  it("Given attack animations with a hitFrame, keys them by name", () => {
    const result = indexAtlasHitFrames({
      Attack: { durations: [2, 3, 4], hitFrame: 2 },
      Shoot: { hitFrame: 1 },
    });
    expect(result.get("Attack")).toBe(2);
    expect(result.get("Shoot")).toBe(1);
  });

  it("Given a hitFrame of 0, keeps it", () => {
    expect(indexAtlasHitFrames({ Charge: { hitFrame: 0 } }).get("Charge")).toBe(0);
  });

  it("Given animations without a hitFrame, drops them", () => {
    const result = indexAtlasHitFrames({ Idle: { durations: [8] }, Walk: {} });
    expect(result.size).toBe(0);
  });

  it("Given no animations, returns an empty map", () => {
    expect(indexAtlasHitFrames(undefined).size).toBe(0);
  });
});

describe("frameDurationMs", () => {
  it("Given PMD ticks, returns ticks × tickMs", () => {
    expect(frameDurationMs([2, 5], 1, TIMING)).toBe(5 * 33);
  });

  it("Given no duration data, returns the fixed fallback", () => {
    expect(frameDurationMs(undefined, 0, TIMING)).toBe(140);
    expect(frameDurationMs([], 0, TIMING)).toBe(140);
  });

  it("Given a 0-tick frame, clamps to one tick", () => {
    expect(frameDurationMs([0], 0, TIMING)).toBe(33);
  });

  it("Given an index past the end, wraps modulo the length", () => {
    expect(frameDurationMs([2, 5], 3, TIMING)).toBe(5 * 33);
  });
});

describe("animationTotalDurationMs", () => {
  it("Given PMD durations, sums the clamped ticks", () => {
    expect(animationTotalDurationMs([2, 0, 3], 3, TIMING)).toBe((2 + 1 + 3) * 33);
  });

  it("Given no duration data, returns frameCount × fallback", () => {
    expect(animationTotalDurationMs(undefined, 4, TIMING)).toBe(4 * 140);
  });
});
