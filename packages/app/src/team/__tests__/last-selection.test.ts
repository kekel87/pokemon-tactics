import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalStorageStub, type LocalStorageStub } from "../../testing/local-storage-stub";
import { clearLastSelection, loadLastSelection, saveLastSelectionEntry } from "../last-selection";

const STORAGE_KEY = "pt:team-select:last-v1";

describe("last-selection storage", () => {
  let stub: LocalStorageStub;

  beforeEach(() => {
    stub = createLocalStorageStub();
    vi.stubGlobal("localStorage", stub.storage);
  });

  afterEach(() => {
    clearLastSelection();
    vi.unstubAllGlobals();
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
    stub.entries.set(STORAGE_KEY, JSON.stringify({ version: 99, bySlot: { 0: "foo" } }));
    expect(loadLastSelection()).toEqual({});
  });

  it("recovers gracefully from corrupted JSON", () => {
    stub.entries.set(STORAGE_KEY, "not-valid-json{");
    expect(loadLastSelection()).toEqual({});
  });

  it("clears all entries", () => {
    saveLastSelectionEntry(0, "team-a");
    clearLastSelection();
    expect(loadLastSelection()).toEqual({});
  });
});
