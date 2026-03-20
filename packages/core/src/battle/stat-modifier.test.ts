import { describe, expect, it } from "vitest";
import { StatusType } from "../enums/status-type";
import { clampStages, getEffectiveStat, getStatMultiplier, isMajorStatus } from "./stat-modifier";

describe("getStatMultiplier", () => {
  it("returns 1 for stage 0", () => {
    expect(getStatMultiplier(0)).toBe(1);
  });

  it("returns correct multipliers for positive stages", () => {
    expect(getStatMultiplier(1)).toBeCloseTo(1.5);
    expect(getStatMultiplier(2)).toBeCloseTo(2);
    expect(getStatMultiplier(3)).toBeCloseTo(2.5);
    expect(getStatMultiplier(4)).toBeCloseTo(3);
    expect(getStatMultiplier(5)).toBeCloseTo(3.5);
    expect(getStatMultiplier(6)).toBeCloseTo(4);
  });

  it("returns correct multipliers for negative stages", () => {
    expect(getStatMultiplier(-1)).toBeCloseTo(2 / 3);
    expect(getStatMultiplier(-2)).toBeCloseTo(0.5);
    expect(getStatMultiplier(-3)).toBeCloseTo(0.4);
    expect(getStatMultiplier(-4)).toBeCloseTo(1 / 3);
    expect(getStatMultiplier(-5)).toBeCloseTo(2 / 7);
    expect(getStatMultiplier(-6)).toBeCloseTo(0.25);
  });
});

describe("getEffectiveStat", () => {
  it("applies multiplier to base stat", () => {
    expect(getEffectiveStat(100, 0)).toBe(100);
    expect(getEffectiveStat(100, 1)).toBe(150);
    expect(getEffectiveStat(100, -1)).toBe(66);
  });
});

describe("clampStages", () => {
  it("adds change to current within bounds", () => {
    expect(clampStages(0, 1)).toBe(1);
    expect(clampStages(0, -1)).toBe(-1);
    expect(clampStages(3, 2)).toBe(5);
  });

  it("clamps at +6", () => {
    expect(clampStages(5, 3)).toBe(6);
    expect(clampStages(6, 1)).toBe(6);
  });

  it("clamps at -6", () => {
    expect(clampStages(-5, -3)).toBe(-6);
    expect(clampStages(-6, -1)).toBe(-6);
  });
});

describe("isMajorStatus", () => {
  it("returns true for major statuses", () => {
    expect(isMajorStatus(StatusType.Burned)).toBe(true);
    expect(isMajorStatus(StatusType.Paralyzed)).toBe(true);
    expect(isMajorStatus(StatusType.Poisoned)).toBe(true);
    expect(isMajorStatus(StatusType.BadlyPoisoned)).toBe(true);
    expect(isMajorStatus(StatusType.Frozen)).toBe(true);
    expect(isMajorStatus(StatusType.Asleep)).toBe(true);
  });

  it("returns false for volatile statuses", () => {
    expect(isMajorStatus(StatusType.Confused)).toBe(false);
  });
});
