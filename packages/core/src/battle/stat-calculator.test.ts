import { describe, expect, it } from "vitest";
import { Nature } from "../enums/nature";
import type { BaseStats } from "../types/base-stats";
import { computeCombatStats, computeStatAtLevel } from "./stat-calculator";

describe("computeStatAtLevel", () => {
  describe("HP formula (IV=31)", () => {
    it("computes Bulbasaur HP at level 50", () => {
      expect(computeStatAtLevel(45, 50, true)).toBe(120);
    });

    it("computes Charmander HP at level 50", () => {
      expect(computeStatAtLevel(39, 50, true)).toBe(114);
    });

    it("computes Squirtle HP at level 50", () => {
      expect(computeStatAtLevel(44, 50, true)).toBe(119);
    });

    it("computes Pidgey HP at level 50", () => {
      expect(computeStatAtLevel(40, 50, true)).toBe(115);
    });

    it("computes Abra HP at level 50 (low base)", () => {
      expect(computeStatAtLevel(25, 50, true)).toBe(100);
    });

    it("computes Jigglypuff HP at level 50 (high base)", () => {
      expect(computeStatAtLevel(115, 50, true)).toBe(190);
    });
  });

  describe("other stats formula (IV=31)", () => {
    it("computes Bulbasaur Attack at level 50", () => {
      expect(computeStatAtLevel(49, 50, false)).toBe(69);
    });

    it("computes Pikachu Speed at level 50", () => {
      expect(computeStatAtLevel(90, 50, false)).toBe(110);
    });

    it("computes Machop Attack at level 50", () => {
      expect(computeStatAtLevel(80, 50, false)).toBe(100);
    });

    it("computes Abra SpAttack at level 50", () => {
      expect(computeStatAtLevel(105, 50, false)).toBe(125);
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
    expect(stats.attack).toBe(100);
    expect(stats.spAttack).toBe(55);
  });

  it("returns same result with neutral nature", () => {
    const noNature = computeCombatStats(machop, 50);
    const hardy = computeCombatStats(machop, 50, Nature.Hardy);
    expect(hardy).toEqual(noNature);
  });

  it("boosts Atk and lowers SpAtk for Adamant", () => {
    // attack at lvl 50 (IV=31) = 100 → floor(100 * 1.1) = 110
    // spAttack at lvl 50 (IV=31) = 55 → floor(55 * 0.9) = 49
    const stats = computeCombatStats(machop, 50, Nature.Adamant);
    expect(stats.attack).toBe(110);
    expect(stats.spAttack).toBe(49);
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

  describe("stat spread (SP)", () => {
    it("adds SP to each stat after nature", () => {
      const stats = computeCombatStats(machop, 50, undefined, { attack: 4 });
      expect(stats.attack).toBe(104);
    });

    it("adds SP to HP", () => {
      const stats = computeCombatStats(machop, 50, undefined, { hp: 10 });
      expect(stats.hp).toBe(computeStatAtLevel(machop.hp, 50, true) + 10);
    });

    it("applies SP after nature — nature does not multiply SP", () => {
      const withNatureOnly = computeCombatStats(machop, 50, Nature.Adamant);
      const withNatureAndSp = computeCombatStats(machop, 50, Nature.Adamant, { attack: 8 });
      expect(withNatureAndSp.attack).toBe(withNatureOnly.attack + 8);
    });

    it("partial spread leaves other stats unchanged", () => {
      const base = computeCombatStats(machop, 50);
      const withSp = computeCombatStats(machop, 50, undefined, { speed: 20 });
      expect(withSp.attack).toBe(base.attack);
      expect(withSp.defense).toBe(base.defense);
      expect(withSp.speed).toBe(base.speed + 20);
    });

    it("no spread = same result as without spread param", () => {
      expect(computeCombatStats(machop, 50, Nature.Hardy, {})).toEqual(
        computeCombatStats(machop, 50, Nature.Hardy),
      );
    });
  });
});
