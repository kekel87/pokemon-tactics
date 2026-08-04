import { PokemonType } from "@pokemon-tactic/core";
import { getTypeName } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import en from "./locales/en";
import fr from "./locales/fr";
import { Language } from "./types";

const MOVE_CATEGORIES = ["physical", "special", "status"] as const;

describe("type + category label coverage", () => {
  it("names every elemental type in both languages", () => {
    for (const type of Object.values(PokemonType)) {
      for (const language of Object.values(Language)) {
        const name = getTypeName(type, language);
        expect(name, `${type} in ${language}`).not.toBe(type);
        expect(name.length).toBeGreaterThan(0);
      }
    }
  });

  it("gives each language a distinct name where the type differs", () => {
    expect(getTypeName(PokemonType.Grass, Language.French)).toBe("Plante");
    expect(getTypeName(PokemonType.Grass, Language.English)).toBe("Grass");
  });

  it("falls back to the raw id for an unknown type", () => {
    expect(getTypeName("cosmic", Language.French)).toBe("cosmic");
  });

  it("translates every move category in both locales", () => {
    for (const category of MOVE_CATEGORIES) {
      expect(fr[`moveCategory.${category}`].length).toBeGreaterThan(0);
      expect(en[`moveCategory.${category}`].length).toBeGreaterThan(0);
    }
  });
});
