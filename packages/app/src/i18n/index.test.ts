import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalStorageStub } from "../testing/local-storage-stub";

const { storage, entries: localStorageMap } = createLocalStorageStub();
vi.stubGlobal("localStorage", storage);
vi.stubGlobal("navigator", { languages: ["fr-FR"], language: "fr-FR" });

const {
  detectLanguage,
  getLanguage,
  initLanguage,
  Language,
  nextLanguage,
  onLanguageChange,
  setLanguage,
  t,
} = await import(".");

describe("i18n", () => {
  beforeEach(() => {
    localStorageMap.clear();
    setLanguage("fr");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("t()", () => {
    it("returns the french translation by default", () => {
      expect(t("action.attack")).toBe("Attaque");
    });

    it("returns the english translation when language is en", () => {
      setLanguage("en");
      expect(t("action.attack")).toBe("Attack");
    });

    it("interpolates parameters", () => {
      expect(t("battle.wins", { player: "Joueur 1" })).toBe("Joueur 1 gagne !");
    });

    it("returns the key if translation is missing", () => {
      const key = "nonexistent.key" as Parameters<typeof t>[0];
      expect(t(key)).toBe("nonexistent.key");
    });

    it("translates battle.fall to Chute in french", () => {
      expect(t("battle.fall")).toBe("Chute");
    });

    it("translates battle.fall to Fall in english", () => {
      setLanguage("en");
      expect(t("battle.fall")).toBe("Fall");
    });

    it("returns the spanish translation when language is es", () => {
      setLanguage(Language.Spanish);
      expect(t("menu.battle")).toBe("Combate");
      expect(t("menu.settings")).toBe("Ajustes");
    });
  });

  describe("setLanguage() / getLanguage()", () => {
    it("changes the current language", () => {
      setLanguage("en");
      expect(getLanguage()).toBe("en");
    });

    it("persists to localStorage", () => {
      setLanguage("en");
      expect(localStorageMap.get("pt-lang")).toBe("en");
    });

    it("does not notify if same language", () => {
      const callback = vi.fn();
      onLanguageChange(callback);
      setLanguage("fr");
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("nextLanguage()", () => {
    it("cycles french → english → spanish → french", () => {
      expect(nextLanguage(Language.French)).toBe(Language.English);
      expect(nextLanguage(Language.English)).toBe(Language.Spanish);
      expect(nextLanguage(Language.Spanish)).toBe(Language.French);
    });
  });

  describe("onLanguageChange()", () => {
    it("calls the callback when language changes", () => {
      const callback = vi.fn();
      onLanguageChange(callback);
      setLanguage("en");
      expect(callback).toHaveBeenCalledWith("en");
    });

    it("returns an unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = onLanguageChange(callback);
      unsubscribe();
      setLanguage("en");
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("detectLanguage()", () => {
    it("returns stored language from localStorage", () => {
      localStorageMap.set("pt-lang", "en");
      expect(detectLanguage()).toBe("en");
    });

    it("returns fr for french browser", () => {
      vi.stubGlobal("navigator", { languages: ["fr-FR", "en-US"], language: "fr-FR" });
      expect(detectLanguage()).toBe("fr");
    });

    it("returns en for english browser", () => {
      vi.stubGlobal("navigator", { languages: ["en-US"], language: "en-US" });
      expect(detectLanguage()).toBe("en");
    });

    it("returns en for unknown language", () => {
      vi.stubGlobal("navigator", { languages: ["ja-JP"], language: "ja-JP" });
      expect(detectLanguage()).toBe("en");
    });

    it("accepts a stored spanish language", () => {
      localStorageMap.set("pt-lang", Language.Spanish);
      vi.stubGlobal("navigator", { languages: ["fr-FR"], language: "fr-FR" });
      expect(detectLanguage()).toBe(Language.Spanish);
    });

    it("ignores a stored language the game does not offer", () => {
      localStorageMap.set("pt-lang", "de");
      vi.stubGlobal("navigator", { languages: ["fr-FR"], language: "fr-FR" });
      expect(detectLanguage()).toBe(Language.French);
    });

    it.each([
      [["es-ES"], Language.Spanish],
      [["es-MX"], Language.Spanish],
      [["en-US", "es"], Language.Spanish],
      [["en-US", "fr"], Language.French],
      [["fr-FR", "es-ES"], Language.French],
      [["es-ES", "fr-FR"], Language.Spanish],
      [["de-DE"], Language.English],
    ])("detects %j as %s", (languages, expected) => {
      vi.stubGlobal("navigator", { languages, language: languages[0] });
      expect(detectLanguage()).toBe(expected);
    });

    it("falls back to navigator.language when navigator.languages is absent", () => {
      vi.stubGlobal("navigator", { language: "es-AR" });
      expect(detectLanguage()).toBe(Language.Spanish);
    });

    it("localStorage takes priority over browser language", () => {
      localStorageMap.set("pt-lang", "fr");
      vi.stubGlobal("navigator", { languages: ["en-US"], language: "en-US" });
      expect(detectLanguage()).toBe("fr");
    });
  });

  describe("initLanguage()", () => {
    it("sets language from browser detection", () => {
      vi.stubGlobal("navigator", { languages: ["en-US"], language: "en-US" });
      initLanguage();
      expect(getLanguage()).toBe("en");
    });
  });
});
