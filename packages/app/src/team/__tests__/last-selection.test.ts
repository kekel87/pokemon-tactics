import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearLastSelection, loadLastSelection, saveLastSelectionEntry } from "../last-selection";

const STORAGE_KEY = "pt:team-select:last-v1";

function setupLocalStorageMock(): { store: Record<string, string> } {
  const store: Record<string, string> = {};
  const mock = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: mock,
    writable: true,
    configurable: true,
  });
  return { store };
}

describe("last-selection storage", () => {
  let mockState: { store: Record<string, string> };

  beforeEach(() => {
    mockState = setupLocalStorageMock();
  });

  afterEach(() => {
    clearLastSelection();
  });

  it("returns empty when nothing stored", () => {
    expect(loadLastSelection()).toEqual({});
  });

  it("saves and reloads per slot", () => {
    saveLastSelectionEntry(0, "team-a");
    saveLastSelectionEntry(1, "team-b");
    expect(loadLastSelection()).toEqual({ 0: "team-a", 1: "team-b" });
  });

  it("removes entry when passing null", () => {
    saveLastSelectionEntry(0, "team-a");
    saveLastSelectionEntry(0, null);
    expect(loadLastSelection()).toEqual({});
  });

  it("ignores stored schema with wrong version", () => {
    mockState.store[STORAGE_KEY] = JSON.stringify({ version: 99, bySlot: { 0: "foo" } });
    expect(loadLastSelection()).toEqual({});
  });

  it("recovers gracefully from corrupted JSON", () => {
    mockState.store[STORAGE_KEY] = "not-valid-json{";
    expect(loadLastSelection()).toEqual({});
  });

  it("clears all entries", () => {
    saveLastSelectionEntry(0, "team-a");
    clearLastSelection();
    expect(loadLastSelection()).toEqual({});
  });
});
