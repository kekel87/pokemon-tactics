import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalStorageStub, type LocalStorageStub } from "../testing/local-storage-stub";
import { MockBattleResume } from "../testing/mock-battle-resume";
import { createBattleResumeStore } from "./battle-persistence";

const STORAGE_KEY = "pt-battle-resume";
const BUILD = "test-build";
const progress = MockBattleResume.savedProgress;

describe("battle persistence", () => {
  let stub: LocalStorageStub;

  beforeEach(() => {
    stub = createLocalStorageStub();
    vi.stubGlobal("localStorage", stub.storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reloads a battle it just saved", () => {
    const store = createBattleResumeStore(BUILD);
    store.save(progress);

    const loaded = store.load();
    expect(loaded?.seed).toBe(MockBattleResume.seed);
    expect(loaded?.mapUrl).toBe(MockBattleResume.mapUrl);
    expect(loaded?.actions).toEqual(MockBattleResume.savedProgress.actions);
    expect(loaded?.placements).toEqual(MockBattleResume.placements);
  });

  it("reports no save when nothing was stored", () => {
    expect(createBattleResumeStore(BUILD).load()).toBeNull();
  });

  it("drops a save written by another build", () => {
    createBattleResumeStore("2026.8.1").save(progress);

    expect(createBattleResumeStore("2026.8.2").load()).toBeNull();
  });

  it("drops a save written by another schema version", () => {
    const store = createBattleResumeStore(BUILD);
    store.save(progress);
    const stored = JSON.parse(stub.entries.get(STORAGE_KEY) ?? "{}");
    stub.entries.set(STORAGE_KEY, JSON.stringify({ ...stored, version: 99 }));

    expect(store.load()).toBeNull();
  });

  it("drops a save whose battle inputs are incomplete", () => {
    const store = createBattleResumeStore(BUILD);
    store.save(progress);
    const stored = JSON.parse(stub.entries.get(STORAGE_KEY) ?? "{}");
    stub.entries.set(STORAGE_KEY, JSON.stringify({ ...stored, placementTeams: [] }));

    expect(store.load()).toBeNull();
  });

  it("drops corrupt stored text instead of throwing", () => {
    stub.entries.set(STORAGE_KEY, "{not json");

    expect(createBattleResumeStore(BUILD).load()).toBeNull();
  });

  it("clears the save", () => {
    const store = createBattleResumeStore(BUILD);
    store.save(progress);
    store.clear();

    expect(store.load()).toBeNull();
    expect(stub.entries.has(STORAGE_KEY)).toBe(false);
  });

  it("stays silent when storage refuses the write", () => {
    vi.stubGlobal("localStorage", {
      ...stub.storage,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });

    expect(() => createBattleResumeStore(BUILD).save(progress)).not.toThrow();
  });
});
