import { describe, expect, it } from "vitest";
import { calculateFallDamage } from "./fall-damage";

describe("calculateFallDamage", () => {
  const MAX_HP = 150;

  it("returns 0 for diff 0 (same height)", () => {
    expect(calculateFallDamage(0, MAX_HP)).toBe(0);
  });

  it("returns 0 for diff 0.5 (half-tile)", () => {
    expect(calculateFallDamage(0.5, MAX_HP)).toBe(0);
  });

  it("returns 0 for diff 1.0 (safe landing)", () => {
    expect(calculateFallDamage(1.0, MAX_HP)).toBe(0);
  });

  it("returns 0 for diff 1.5 (still in tier 1)", () => {
    expect(calculateFallDamage(1.5, MAX_HP)).toBe(0);
  });

  it("returns 33% maxHp for diff 2.0", () => {
    expect(calculateFallDamage(2.0, MAX_HP)).toBe(Math.floor(0.33 * MAX_HP));
  });

  it("returns 33% maxHp for diff 2.5 (still tier 2)", () => {
    expect(calculateFallDamage(2.5, MAX_HP)).toBe(Math.floor(0.33 * MAX_HP));
  });

  it("returns 66% maxHp for diff 3.0", () => {
    expect(calculateFallDamage(3.0, MAX_HP)).toBe(Math.floor(0.66 * MAX_HP));
  });

  it("returns 66% maxHp for diff 3.5 (still tier 3)", () => {
    expect(calculateFallDamage(3.5, MAX_HP)).toBe(Math.floor(0.66 * MAX_HP));
  });

  it("returns 100% maxHp for diff 4.0 (lethal)", () => {
    expect(calculateFallDamage(4.0, MAX_HP)).toBe(MAX_HP);
  });

  it("returns 100% maxHp for diff 5.0 (capped at lethal)", () => {
    expect(calculateFallDamage(5.0, MAX_HP)).toBe(MAX_HP);
  });

  it("returns 100% maxHp for diff 10.0 (extreme fall)", () => {
    expect(calculateFallDamage(10.0, MAX_HP)).toBe(MAX_HP);
  });

  it("works with different maxHp values", () => {
    expect(calculateFallDamage(2.0, 200)).toBe(66);
    expect(calculateFallDamage(3.0, 100)).toBe(66);
    expect(calculateFallDamage(4.0, 50)).toBe(50);
  });
});
