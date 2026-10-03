import { describe, expect, it } from "vitest";
import { completeLocalizedText, localizedText } from "./localized-text";

const FLAMETHROWER = { fr: "Lance-Flammes", en: "Flamethrower", es: "Lanzallamas" } as const;

describe("localizedText", () => {
  it("returns the text in the requested language", () => {
    expect(localizedText(FLAMETHROWER, "es")).toBe("Lanzallamas");
    expect(localizedText(FLAMETHROWER, "fr")).toBe("Lance-Flammes");
  });

  it("falls back to english when the language has an empty text", () => {
    expect(localizedText({ ...FLAMETHROWER, es: "" }, "es")).toBe("Flamethrower");
  });

  it("falls back to english for a language the game does not offer", () => {
    expect(localizedText(FLAMETHROWER, "de")).toBe("Flamethrower");
  });
});

describe("completeLocalizedText", () => {
  it("turns a missing reference text into an empty one", () => {
    expect(completeLocalizedText({ fr: null, en: "Flamethrower", es: null })).toEqual({
      fr: "",
      en: "Flamethrower",
      es: "",
    });
  });

  it("keeps every text the reference has", () => {
    expect(completeLocalizedText(FLAMETHROWER)).toEqual(FLAMETHROWER);
  });

  it("produces a text that localizedText reads as english", () => {
    const completed = completeLocalizedText({ fr: "Lance-Flammes", en: "Flamethrower", es: null });
    expect(localizedText(completed, "es")).toBe("Flamethrower");
  });
});
