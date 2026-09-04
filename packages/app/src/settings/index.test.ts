import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalStorageStub, type LocalStorageStub } from "../testing/local-storage-stub";
import { getSettings, initSettings, updateSettings } from "./index";

const STORAGE_KEY = "pt-settings";

const DEFAULTS = { damagePreview: true, autoPlacement: true, invertRightStick: false };

describe("préférences persistées", () => {
  let stub: LocalStorageStub;

  beforeEach(() => {
    stub = createLocalStorageStub();
    vi.stubGlobal("localStorage", stub.storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("part sur les défauts quand rien n'est enregistré", () => {
    initSettings();

    expect(getSettings()).toMatchObject({ autoPlacement: true, damagePreview: true });
  });

  it("relit les deux paramètres de partie enregistrés", () => {
    stub.entries.set(STORAGE_KEY, JSON.stringify({ autoPlacement: false, damagePreview: false }));

    initSettings();

    expect(getSettings()).toMatchObject({ autoPlacement: false, damagePreview: false });
  });

  it("écrit chaque paramètre de partie dans le magasin", () => {
    initSettings();

    updateSettings({ autoPlacement: false });
    updateSettings({ damagePreview: false });

    expect(JSON.parse(stub.entries.get(STORAGE_KEY) ?? "{}")).toMatchObject({
      autoPlacement: false,
      damagePreview: false,
    });
  });

  it("complète une clé absente par son défaut, sans écraser les choix déjà enregistrés", () => {
    stub.entries.set(STORAGE_KEY, JSON.stringify({ damagePreview: false, invertRightStick: true }));

    initSettings();

    expect(getSettings()).toEqual({
      autoPlacement: true,
      damagePreview: false,
      invertRightStick: true,
    });
  });

  it("retombe sur les défauts si le magasin est illisible", () => {
    stub.entries.set(STORAGE_KEY, "{pas du json");

    initSettings();

    expect(getSettings()).toMatchObject({ autoPlacement: true, damagePreview: true });
  });

  it.each(["null", '"texte"', "42", "[1, 2]"])(
    "retombe sur les défauts si le magasin porte %s au lieu d'un objet",
    (payload) => {
      stub.entries.set(STORAGE_KEY, payload);

      initSettings();

      expect(getSettings()).toEqual(DEFAULTS);
    },
  );

  it.each([
    ["null", null],
    ["une chaîne", "false"],
    ["un nombre", 0],
  ])("ignore un %s à la place d'un booléen et garde le défaut", (_label, value) => {
    stub.entries.set(STORAGE_KEY, JSON.stringify({ damagePreview: value, autoPlacement: false }));

    initSettings();

    expect(getSettings().damagePreview).toBe(true);
    expect(getSettings().autoPlacement).toBe(false);
  });
});
