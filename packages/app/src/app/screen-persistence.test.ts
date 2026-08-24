import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalStorageStub } from "../testing/local-storage-stub";
import { loadPersistedScreen, saveCurrentScreen } from "./screen-persistence";

const STORAGE_KEY = "pt-last-screen";

describe("screen persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createLocalStorageStub().storage);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("restores a parameterless screen that was saved", () => {
    saveCurrentScreen("my-teams");

    expect(loadPersistedScreen()).toBe("my-teams");
  });

  it("returns null when nothing was saved", () => {
    expect(loadPersistedScreen()).toBeNull();
  });

  it.each(["team-select", "team-edit", "combat"] as const)(
    "does not persist %s, which cannot be restored without its params",
    (screenId) => {
      saveCurrentScreen(screenId);

      expect(loadPersistedScreen()).toBeNull();
    },
  );

  it("clears an earlier resume point when moving to a screen with params", () => {
    saveCurrentScreen("map-select");
    saveCurrentScreen("combat");

    expect(loadPersistedScreen()).toBeNull();
  });

  it("ignores an entry older than an hour", () => {
    vi.useFakeTimers();
    saveCurrentScreen("settings");

    vi.advanceTimersByTime(60 * 60 * 1000 + 1);

    expect(loadPersistedScreen()).toBeNull();
  });

  it("keeps an entry younger than an hour", () => {
    vi.useFakeTimers();
    saveCurrentScreen("settings");

    vi.advanceTimersByTime(59 * 60 * 1000);

    expect(loadPersistedScreen()).toBe("settings");
  });

  it("ignores an unknown screen id", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: "arena-editor", savedAt: Date.now() }));

    expect(loadPersistedScreen()).toBeNull();
  });

  it("ignores a malformed entry", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");

    expect(loadPersistedScreen()).toBeNull();
  });

  it("ignores an entry without a timestamp", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: "credits" }));

    expect(loadPersistedScreen()).toBeNull();
  });

  it("ignores an entry that is not an object", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify("settings"));

    expect(loadPersistedScreen()).toBeNull();
  });

  it("does not throw when storage refuses to write", () => {
    const refusing = createLocalStorageStub().storage;
    refusing.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    vi.stubGlobal("localStorage", refusing);

    expect(() => saveCurrentScreen("settings")).not.toThrow();
  });

  it("does not throw when storage refuses to read", () => {
    const refusing = createLocalStorageStub().storage;
    refusing.getItem = () => {
      throw new Error("SecurityError");
    };
    vi.stubGlobal("localStorage", refusing);

    expect(loadPersistedScreen()).toBeNull();
  });
});
