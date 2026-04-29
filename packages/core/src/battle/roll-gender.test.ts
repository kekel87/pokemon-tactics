import { describe, expect, it } from "vitest";
import { PokemonGender } from "../enums/pokemon-gender";
import { rollGender } from "./roll-gender";

describe("rollGender", () => {
  it("returns Genderless for genderless ratio regardless of rng", () => {
    expect(rollGender("genderless", () => 0)).toBe(PokemonGender.Genderless);
    expect(rollGender("genderless", () => 0.999)).toBe(PokemonGender.Genderless);
  });

  it("returns Female for 0/100 ratio", () => {
    expect(rollGender({ male: 0, female: 100 }, () => 0)).toBe(PokemonGender.Female);
    expect(rollGender({ male: 0, female: 100 }, () => 0.99)).toBe(PokemonGender.Female);
  });

  it("returns Male for 100/0 ratio", () => {
    expect(rollGender({ male: 100, female: 0 }, () => 0)).toBe(PokemonGender.Male);
    expect(rollGender({ male: 100, female: 0 }, () => 0.99)).toBe(PokemonGender.Male);
  });

  it("respects 87.5/12.5 distribution", () => {
    expect(rollGender({ male: 87.5, female: 12.5 }, () => 0.0)).toBe(PokemonGender.Male);
    expect(rollGender({ male: 87.5, female: 12.5 }, () => 0.874)).toBe(PokemonGender.Male);
    expect(rollGender({ male: 87.5, female: 12.5 }, () => 0.876)).toBe(PokemonGender.Female);
  });

  it("approximates 25/75 distribution over 1000 rolls", () => {
    let male = 0;
    const seed = mulberry32(42);
    for (let i = 0; i < 1000; i += 1) {
      if (rollGender({ male: 25, female: 75 }, seed) === PokemonGender.Male) {
        male += 1;
      }
    }
    expect(male).toBeGreaterThan(220);
    expect(male).toBeLessThan(280);
  });
});

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
