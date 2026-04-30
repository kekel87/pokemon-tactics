import { describe, expect, it } from "vitest";
import { Nature } from "../enums/nature";
import type { BaseStats } from "../types/base-stats";
import { computeCombatStats, computeStatAtLevel } from "./stat-calculator";

describe("computeStatAtLevel", () => {
  describe("HP formula", () => {
    it("computes Bulbasaur HP at level 50", () => {
      expect(computeStatAtLevel(45, 50, true)).toBe(105);
    });

    it("computes Charmander HP at level 50", () => {
      expect(computeStatAtLevel(39, 50, true)).toBe(99);
    });

    it("computes Squirtle HP at level 50", () => {
      expect(computeStatAtLevel(44, 50, true)).toBe(104);
    });

    it("computes Pidgey HP at level 50", () => {
      expect(computeStatAtLevel(40, 50, true)).toBe(100);
    });

    it("computes Abra HP at level 50 (low base)", () => {
      expect(computeStatAtLevel(25, 50, true)).toBe(85);
    });

    it("computes Jigglypuff HP at level 50 (high base)", () => {
      expect(computeStatAtLevel(115, 50, true)).toBe(175);
    });
  });

  describe("other stats formula", () => {
    it("computes Bulbasaur Attack at level 50", () => {
      expect(computeStatAtLevel(49, 50, false)).toBe(54);
    });

    it("computes Pikachu Speed at level 50", () => {
      expect(computeStatAtLevel(90, 50, false)).toBe(95);
    });

    it("computes Machop Attack at level 50", () => {
      expect(computeStatAtLevel(80, 50, false)).toBe(85);
    });

    it("computes Abra SpAttack at level 50", () => {
      expect(computeStatAtLevel(105, 50, false)).toBe(110);
    });
  });
});

describe("computeCombatStats", () => {
  const machop: BaseStats = {
    hp: 70,
    attack: 80,
    defense: 50,
    spAttack: 35,
    spDefense: 35,
    speed: 35,
  };

  it("computes leveled stats unchanged when no nature given", () => {
    const stats = computeCombatStats(machop, 50);
    expect(stats.attack).toBe(85);
    expect(stats.spAttack).toBe(40);
  });

  it("returns same result with neutral nature", () => {
    const noNature = computeCombatStats(machop, 50);
    const hardy = computeCombatStats(machop, 50, Nature.Hardy);
    expect(hardy).toEqual(noNature);
  });

  it("boosts Atk and lowers SpAtk for Adamant", () => {
    // attack at lvl 50 = 85 → floor(85 * 1.1) = 93
    // spAttack at lvl 50 = 40 → floor(40 * 0.9) = 36
    const stats = computeCombatStats(machop, 50, Nature.Adamant);
    expect(stats.attack).toBe(93);
    expect(stats.spAttack).toBe(36);
  });

  it("never modifies HP regardless of nature", () => {
    const adamant = computeCombatStats(machop, 50, Nature.Adamant);
    const modest = computeCombatStats(machop, 50, Nature.Modest);
    const bold = computeCombatStats(machop, 50, Nature.Bold);
    const timid = computeCombatStats(machop, 50, Nature.Timid);
    const baseHp = computeStatAtLevel(machop.hp, 50, true);
    expect(adamant.hp).toBe(baseHp);
    expect(modest.hp).toBe(baseHp);
    expect(bold.hp).toBe(baseHp);
    expect(timid.hp).toBe(baseHp);
  });
});
