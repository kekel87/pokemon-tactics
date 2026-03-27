import { describe, expect, it } from "vitest";
import { computeStatAtLevel } from "./stat-calculator";

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
