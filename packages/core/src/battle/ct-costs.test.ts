import { describe, expect, it } from "vitest";
import { EffectTier } from "../enums/effect-tier";
import {
  computeCtActionCost,
  computeCtGain,
  computeMoveCost,
  effectFloor,
  powerFloor,
  ppCost,
} from "./ct-costs";

describe("ppCost", () => {
  it("returns 500 for 20 PP", () => expect(ppCost(20)).toBe(500));
  it("returns 600 for 16 PP", () => expect(ppCost(16)).toBe(600));
  it("returns 700 for 12 PP", () => expect(ppCost(12)).toBe(700));
  it("returns 900 for 8 PP", () => expect(ppCost(8)).toBe(900));
});

describe("powerFloor", () => {
  it("returns 0 for power 40", () => expect(powerFloor(40)).toBe(0));
  it("returns 600 for power 70", () => expect(powerFloor(70)).toBe(600));
  it("returns 600 for power 89", () => expect(powerFloor(89)).toBe(600));
  it("returns 700 for power 90", () => expect(powerFloor(90)).toBe(700));
  it("returns 900 for power 110", () => expect(powerFloor(110)).toBe(900));
  it("returns 900 for power 150", () => expect(powerFloor(150)).toBe(900));
});

describe("effectFloor", () => {
  it("returns 0 for undefined", () => expect(effectFloor(undefined)).toBe(0));
  it("returns 500 for reactive", () => expect(effectFloor(EffectTier.Reactive)).toBe(500));
  it("returns 700 for major-status", () => expect(effectFloor(EffectTier.MajorStatus)).toBe(700));
  it("returns 600 for major-buff", () => expect(effectFloor(EffectTier.MajorBuff)).toBe(600));
  it("returns 550 for double-buff", () => expect(effectFloor(EffectTier.DoubleBuff)).toBe(550));
});

describe("computeMoveCost", () => {
  it("Scratch (20PP, 40p) → 500", () => expect(computeMoveCost(20, 40, undefined)).toBe(500));
  it("Slash (20PP, 70p) → 600 (powerFloor kicks in)", () =>
    expect(computeMoveCost(20, 70, undefined)).toBe(600));
  it("Thunderbolt (16PP, 90p) → 700", () => expect(computeMoveCost(16, 90, undefined)).toBe(700));
  it("Volt Tackle (16PP, 120p) → 900", () => expect(computeMoveCost(16, 120, undefined)).toBe(900));
  it("Earthquake (12PP, 100p) → 700", () => expect(computeMoveCost(12, 100, undefined)).toBe(700));
  it("Hyper Beam (8PP, 150p) → 900", () => expect(computeMoveCost(8, 150, undefined)).toBe(900));
  it("Thunder Wave (20PP, 0p, major-status) → 700", () =>
    expect(computeMoveCost(20, 0, EffectTier.MajorStatus)).toBe(700));
  it("Agility (20PP, 0p, major-buff) → 600", () =>
    expect(computeMoveCost(20, 0, EffectTier.MajorBuff)).toBe(600));
  it("Calm Mind (20PP, 0p, double-buff) → 550", () =>
    expect(computeMoveCost(20, 0, EffectTier.DoubleBuff)).toBe(550));
  it("Protect (8PP, reactive) → 500 fixed", () =>
    expect(computeMoveCost(8, 0, EffectTier.Reactive)).toBe(500));
});

describe("computeCtActionCost", () => {
  it("Wait (no move, no act) → 350", () =>
    expect(computeCtActionCost(false, false, 600)).toBe(350));
  it("Move only → 400", () => expect(computeCtActionCost(true, false, 600)).toBe(400));
  it("Attack only → moveCost", () => expect(computeCtActionCost(false, true, 700)).toBe(700));
  it("Move + Attack → move + atk - 150", () =>
    expect(computeCtActionCost(true, true, 700)).toBe(400 + 700 - 150));
});

describe("computeCtGain", () => {
  it("neutral stages: Geodude base 40 returns positive gain", () => {
    const gain = computeCtGain(40, 0);
    expect(gain).toBeGreaterThan(0);
    expect(gain).toBe(104);
  });

  it("Agility +2 gives 1.69x ratio", () => {
    const base = computeCtGain(90, 0);
    const boosted = computeCtGain(90, 2);
    expect(boosted / base).toBeCloseTo(1.69, 1);
  });

  it("Icy Wind -2 gives ~0.59x ratio", () => {
    const base = computeCtGain(90, 0);
    const debuffed = computeCtGain(90, -2);
    expect(debuffed / base).toBeCloseTo(0.59, 1);
  });

  it("extreme speed gap (200 vs 5) ratio ≤ 2.5x — compressed vs raw 40x gap", () => {
    const regi = computeCtGain(200, 0);
    const shuckle = computeCtGain(5, 0);
    const ratio = regi / shuckle;
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThanOrEqual(2.5);
  });
});
