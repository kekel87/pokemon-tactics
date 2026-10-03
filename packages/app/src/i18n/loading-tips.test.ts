import { createPrng } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { LOADING_TIPS, pickRandomTip } from "./loading-tips";
import { LOCALES } from "./locales";

describe("LOADING_TIPS", () => {
  it("has unique ids", () => {
    const ids = LOADING_TIPS.map((tip) => tip.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves every key in every locale", () => {
    for (const tip of LOADING_TIPS) {
      for (const [language, locale] of Object.entries(LOCALES)) {
        expect(locale[tip.key], `missing ${language} key for ${tip.id}`).toBeTruthy();
      }
    }
  });
});

describe("pickRandomTip", () => {
  it("returns a tip from the pool", () => {
    const tip = pickRandomTip(createPrng(0), []);
    expect(LOADING_TIPS.some((t) => t.id === tip.id)).toBe(true);
  });

  it("avoids ids in lastShownIds when alternatives exist", () => {
    const exclude = LOADING_TIPS.slice(0, LOADING_TIPS.length - 1).map((t) => t.id);
    const tip = pickRandomTip(createPrng(42), exclude);
    expect(exclude.includes(tip.id)).toBe(false);
  });

  it("falls back to the full pool when every tip is excluded", () => {
    const allIds = LOADING_TIPS.map((t) => t.id);
    const tip = pickRandomTip(createPrng(7), allIds);
    expect(LOADING_TIPS.some((t) => t.id === tip.id)).toBe(true);
  });
});
