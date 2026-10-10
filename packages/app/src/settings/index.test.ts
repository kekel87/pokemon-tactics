import { CombatSpeed, isInstantCombat } from "@pokemon-tactic/view-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initAudio, setMasterVolume } from "../audio/audio-player";
import { createLocalStorageStub, type LocalStorageStub } from "../testing/local-storage-stub";
import { getSettings, initSettings, MAX_VOLUME, TurnCries, updateSettings } from "./index";

vi.mock("../audio/audio-player", () => ({ initAudio: vi.fn(), setMasterVolume: vi.fn() }));

const STORAGE_KEY = "pt-settings";

const DEFAULTS = {
  damagePreview: true,
  autoPlacement: true,
  lastMapId: "simple-arena",
  invertRightStick: false,
  combatSpeed: CombatSpeed.Normal,
  volume: 75,
  muted: false,
  turnCries: TurnCries.Mine,
};

let stub: LocalStorageStub;

beforeEach(() => {
  stub = createLocalStorageStub();
  vi.stubGlobal("localStorage", stub.storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("préférences persistées", () => {
  it("part sur les défauts quand rien n'est enregistré", () => {
    initSettings();

    expect(getSettings()).toEqual(DEFAULTS);
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
      lastMapId: "simple-arena",
      invertRightStick: true,
      combatSpeed: CombatSpeed.Normal,
      volume: 75,
      muted: false,
      turnCries: TurnCries.Mine,
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

  it("relit la vitesse des combats enregistrée et l'applique au rythme des combats", () => {
    stub.entries.set(STORAGE_KEY, JSON.stringify({ combatSpeed: CombatSpeed.Instant }));

    initSettings();

    expect(getSettings().combatSpeed).toBe(CombatSpeed.Instant);
    expect(isInstantCombat()).toBe(true);
  });

  it("écrit la vitesse des combats choisie dans le magasin", () => {
    initSettings();

    updateSettings({ combatSpeed: CombatSpeed.Instant });

    expect(isInstantCombat()).toBe(true);
    expect(JSON.parse(stub.entries.get(STORAGE_KEY) ?? "{}")).toMatchObject({
      combatSpeed: CombatSpeed.Instant,
    });
  });

  it("rejette une vitesse des combats inconnue et garde la vitesse normale", () => {
    stub.entries.set(
      STORAGE_KEY,
      JSON.stringify({ combatSpeed: "ludicrous", autoPlacement: false }),
    );

    initSettings();

    expect(getSettings().combatSpeed).toBe(CombatSpeed.Normal);
    expect(getSettings().autoPlacement).toBe(false);
  });

  it("relit le volume, la sourdine et le cri de tour enregistrés", () => {
    stub.entries.set(
      STORAGE_KEY,
      JSON.stringify({ volume: 40, muted: true, turnCries: TurnCries.All }),
    );

    initSettings();

    expect(getSettings()).toMatchObject({ volume: 40, muted: true, turnCries: TurnCries.All });
  });

  it.each([0, 5, MAX_VOLUME])("accepte un volume de %i, bornes comprises", (volume) => {
    stub.entries.set(STORAGE_KEY, JSON.stringify({ volume }));

    initSettings();

    expect(getSettings().volume).toBe(volume);
  });

  it.each([
    ["négatif", -5],
    ["au-delà du maximum", MAX_VOLUME + 1],
    ["non entier", 42.5],
    ["en chaîne", "40"],
    ["nul", null],
  ])("rejette un volume %s et garde le défaut", (_label, volume) => {
    stub.entries.set(STORAGE_KEY, JSON.stringify({ volume, autoPlacement: false }));

    initSettings();

    expect(getSettings().volume).toBe(DEFAULTS.volume);
    expect(getSettings().autoPlacement).toBe(false);
  });

  it.each([
    ["une chaîne", "true"],
    ["un nombre", 1],
  ])("ignore %s à la place de la sourdine et laisse le son", (_label, muted) => {
    stub.entries.set(STORAGE_KEY, JSON.stringify({ muted }));

    initSettings();

    expect(getSettings().muted).toBe(false);
  });

  it("rejette un cri de tour inconnu et garde « mes Pokémon »", () => {
    stub.entries.set(STORAGE_KEY, JSON.stringify({ turnCries: "everyone", muted: true }));

    initSettings();

    expect(getSettings().turnCries).toBe(TurnCries.Mine);
    expect(getSettings().muted).toBe(true);
  });

  it("ramène l'ancienne vitesse « rapide », supprimée, à la vitesse normale", () => {
    stub.entries.set(STORAGE_KEY, JSON.stringify({ combatSpeed: "fast" }));

    initSettings();

    expect(getSettings().combatSpeed).toBe(CombatSpeed.Normal);
    expect(isInstantCombat()).toBe(false);
  });

  it("écrit le volume, la sourdine et le cri de tour choisis dans le magasin", () => {
    initSettings();

    updateSettings({ volume: 30 });
    updateSettings({ muted: true });
    updateSettings({ turnCries: TurnCries.None });

    expect(JSON.parse(stub.entries.get(STORAGE_KEY) ?? "{}")).toMatchObject({
      volume: 30,
      muted: true,
      turnCries: TurnCries.None,
    });
  });

  it("garde le volume réglé quand on coupe puis remet le son", () => {
    initSettings();
    updateSettings({ volume: 30 });

    updateSettings({ muted: true });
    updateSettings({ muted: false });

    expect(getSettings()).toMatchObject({ volume: 30, muted: false });
  });
});

describe("volume appliqué au moteur audio", () => {
  beforeEach(() => {
    vi.mocked(initAudio).mockClear();
    vi.mocked(setMasterVolume).mockClear();
  });

  it("ouvre l'audio au volume enregistré, ramené entre 0 et 1", () => {
    stub.entries.set(STORAGE_KEY, JSON.stringify({ volume: 40 }));

    initSettings();

    expect(initAudio).toHaveBeenCalledWith(0.4);
  });

  it("ouvre l'audio à zéro quand le son est coupé", () => {
    stub.entries.set(STORAGE_KEY, JSON.stringify({ volume: 40, muted: true }));

    initSettings();

    expect(initAudio).toHaveBeenCalledWith(0);
  });

  it("applique en direct le volume, la sourdine, puis le volume retrouvé", () => {
    initSettings();

    updateSettings({ volume: 20 });
    updateSettings({ muted: true });
    updateSettings({ muted: false });

    expect(vi.mocked(setMasterVolume).mock.calls).toEqual([[0.2], [0], [0.2]]);
  });
});
