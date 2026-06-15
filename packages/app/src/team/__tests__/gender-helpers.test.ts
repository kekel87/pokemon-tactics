import { PokemonGender } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { pickDefaultGender, toggleGender } from "../gender-helpers";

describe("pickDefaultGender", () => {
  it("returns undefined for genderless species", () => {
    expect(pickDefaultGender("genderless")).toBeUndefined();
  });

  it("returns Male when male ratio is greater", () => {
    expect(pickDefaultGender({ male: 75, female: 25 })).toBe(PokemonGender.Male);
  });

  it("returns Female when female ratio is greater", () => {
    expect(pickDefaultGender({ male: 12.5, female: 87.5 })).toBe(PokemonGender.Female);
  });

  it("returns Female for female-only species", () => {
    expect(pickDefaultGender({ male: 0, female: 100 })).toBe(PokemonGender.Female);
  });

  it("returns Male for male-only species", () => {
    expect(pickDefaultGender({ male: 100, female: 0 })).toBe(PokemonGender.Male);
  });

  it("picks Male when 50/50 and rng < 0.5", () => {
    expect(pickDefaultGender({ male: 50, female: 50 }, () => 0.4)).toBe(PokemonGender.Male);
  });

  it("picks Female when 50/50 and rng >= 0.5", () => {
    expect(pickDefaultGender({ male: 50, female: 50 }, () => 0.9)).toBe(PokemonGender.Female);
  });

  it("returns undefined when both ratios are zero (defensive)", () => {
    expect(pickDefaultGender({ male: 0, female: 0 })).toBeUndefined();
  });
});

describe("toggleGender", () => {
  it("toggles Male to Female", () => {
    expect(toggleGender(PokemonGender.Male)).toBe(PokemonGender.Female);
  });

  it("toggles Female to Male", () => {
    expect(toggleGender(PokemonGender.Female)).toBe(PokemonGender.Male);
  });
});
