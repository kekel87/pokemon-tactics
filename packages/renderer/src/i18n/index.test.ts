import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const localStorageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => localStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => localStorageMap.set(key, value),
  removeItem: (key: string) => localStorageMap.delete(key),
  clear: () => localStorageMap.clear(),
};
vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("navigator", { languages: ["fr-FR"], language: "fr-FR" });

const { detectLanguage, getLanguage, initLanguage, onLanguageChange, setLanguage, t } =
  await import(".");

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
      expect(t("battle.round", { round: 5 })).toBe("Round 5");
    });

    it("interpolates multiple parameters", () => {
      expect(t("battle.wins", { player: "Joueur 1", round: 3 })).toBe("Joueur 1 gagne ! — Round 3");
    });

    it("returns the key if translation is missing", () => {
      const key = "nonexistent.key" as Parameters<typeof t>[0];
      expect(t(key)).toBe("nonexistent.key");
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
