import { describe, expect, it } from "vitest";
import { validateStatSpread } from "./stat-spread-validator";

describe("validateStatSpread", () => {
  it("empty spread is valid", () => {
    expect(validateStatSpread({})).toEqual({ valid: true, errors: [] });
  });

  it("all zeros is valid", () => {
    expect(
      validateStatSpread({ hp: 0, attack: 0, defense: 0, spAttack: 0, spDefense: 0, speed: 0 }),
    ).toEqual({ valid: true, errors: [] });
  });

  it("single stat at max is valid", () => {
    expect(validateStatSpread({ attack: 32 })).toEqual({ valid: true, errors: [] });
  });

  it("single stat over max is invalid", () => {
    const result = validateStatSpread({ attack: 33 });
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("attack");
  });

  it("negative stat is invalid", () => {
    const result = validateStatSpread({ speed: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("speed");
  });

  it("total at 66 is valid", () => {
    expect(validateStatSpread({ hp: 32, attack: 32, defense: 2 })).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("total over 66 is invalid", () => {
    const result = validateStatSpread({ hp: 32, attack: 32, defense: 3 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("total"))).toBe(true);
  });

  it("reports multiple errors", () => {
    const result = validateStatSpread({ attack: 33, speed: 33 });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("total error is separate from per-stat errors", () => {
    const result = validateStatSpread({ hp: 20, attack: 20, defense: 20, spAttack: 10 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("total"))).toBe(true);
    expect(result.errors.every((e) => !e.includes("<= 32"))).toBe(true);
  });
});
