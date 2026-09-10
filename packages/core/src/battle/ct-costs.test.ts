import { describe, expect, it } from "vitest";
import { EffectTier } from "../enums/effect-tier";
import {
  CT_LOG_DOMAIN_MAX,
  CT_LOG_STEPS,
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

describe("computeCtGain — table de paliers figée (plan 203, Lot B4)", () => {
  /** L'ancienne formule, gardée ICI seulement, comme oracle de non-régression. */
  const previousFormula = (baseStat: number): number =>
    30 + Math.floor(20 * Math.log(baseStat + 1));

  it("reproduces the previous formula over the whole tabulated domain", () => {
    const mismatches: number[] = [];
    for (let baseStat = 1; baseStat <= CT_LOG_DOMAIN_MAX; baseStat += 1) {
      if (computeCtGain(baseStat, 0) !== Math.floor(previousFormula(baseStat))) {
        mismatches.push(baseStat);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("reproduces the previous formula at every stat stage, not just at zero", () => {
    const mismatches: string[] = [];
    for (let baseStat = 1; baseStat <= 400; baseStat += 1) {
      for (let stages = -6; stages <= 6; stages += 1) {
        const soft = stages * 0.7;
        const expected = Math.floor(
          previousFormula(baseStat) * (soft >= 0 ? (2 + soft) / 2 : 2 / (2 - soft)),
        );
        if (computeCtGain(baseStat, stages) !== expected) {
          mismatches.push(`${baseStat}/${stages}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("keeps the roster inside the tabulated domain", () => {
    const fastestBaseSpeed = 200; // Regieleki
    expect(fastestBaseSpeed * 4).toBeLessThanOrEqual(CT_LOG_DOMAIN_MAX);
  });

  it("falls back deterministically outside the domain, never back to Math.log", () => {
    expect(computeCtGain(0, 0)).toBe(computeCtGain(1, 0));
    expect(computeCtGain(-5, 0)).toBe(computeCtGain(1, 0));
    expect(computeCtGain(CT_LOG_DOMAIN_MAX + 1000, 0)).toBe(computeCtGain(CT_LOG_DOMAIN_MAX, 0));
  });

  it("floors a non-integer input", () => {
    expect(computeCtGain(100.9, 0)).toBe(computeCtGain(100, 0));
  });
});

describe("CT_LOG_STEPS — l'invariant dont ctLogStep dépend", () => {
  it("keeps its thresholds strictly ascending", () => {
    const thresholds = CT_LOG_STEPS.map(([threshold]) => threshold);
    expect(thresholds).toEqual([...thresholds].sort((left, right) => left - right));
    expect(new Set(thresholds).size).toBe(thresholds.length);
  });

  it("starts at the threshold the fallback constant assumes", () => {
    expect(CT_LOG_STEPS[0]).toEqual([1, 13]);
  });
});
