import { CombatSpeed, isInstantCombat } from "@pokemon-tactic/view-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initAudio, setAudioVolumes } from "../audio/audio-player";
import { createLocalStorageStub, type LocalStorageStub } from "../testing/local-storage-stub";
import { getSettings, initSettings, MAX_VOLUME, TurnCries, updateSettings } from "./index";

vi.mock("../audio/audio-player", () => ({ initAudio: vi.fn(), setAudioVolumes: vi.fn() }));

const STORAGE_KEY = "pt-settings";

const DEFAULTS = {
  damagePreview: true,
  autoPlacement: true,
  lastMapId: "simple-arena",
  invertRightStick: false,
  combatSpeed: CombatSpeed.Normal,
  volume: 75,
  muted: false,
  effectsVolume: 100,
  effectsMuted: false,
  musicVolume: 55,
  musicMuted: false,
  lastMusicId: "random",
  turnCries: TurnCries.Mine,
};

const TYPE_VOLUME_KEYS = ["effectsVolume", "musicVolume"] as const;
const MUTED_KEY_OF = { effectsVolume: "effectsMuted", musicVolume: "musicMuted" } as const;

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
      effectsVolume: 100,
      effectsMuted: false,
      musicVolume: 55,
      musicMuted: false,
      lastMusicId: "random",
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

  it.each(TYPE_VOLUME_KEYS)("relit le volume et la sourdine enregistrés sous %s", (key) => {
    const mutedKey = MUTED_KEY_OF[key];
    stub.entries.set(STORAGE_KEY, JSON.stringify({ [key]: 35, [mutedKey]: true }));

    initSettings();

    expect(getSettings()).toMatchObject({ [key]: 35, [mutedKey]: true });
  });

  it.each(
    TYPE_VOLUME_KEYS.flatMap((key) => [0, 5, MAX_VOLUME].map((volume) => [key, volume] as const)),
  )("accepte %s à %i, bornes comprises", (key, volume) => {
    stub.entries.set(STORAGE_KEY, JSON.stringify({ [key]: volume }));

    initSettings();

    expect(getSettings()[key]).toBe(volume);
  });

  it.each(
    TYPE_VOLUME_KEYS.flatMap((key) =>
      [
        ["négatif", -5],
        ["au-delà du maximum", MAX_VOLUME + 1],
        ["non entier", 42.5],
        ["en chaîne", "40"],
        ["nul", null],
      ].map(([label, volume]) => [key, label, volume] as const),
    ),
  )("rejette %s %s et garde son défaut, sans toucher aux autres volumes", (key, _label, volume) => {
    stub.entries.set(STORAGE_KEY, JSON.stringify({ [key]: volume, volume: 30 }));

    initSettings();

    expect(getSettings()[key]).toBe(DEFAULTS[key]);
    expect(getSettings().volume).toBe(30);
  });

  it.each(
    Object.values(MUTED_KEY_OF).flatMap((key) =>
      [
        ["une chaîne", "true"],
        ["un nombre", 1],
        ["null", null],
      ].map(([label, muted]) => [label, key, muted] as const),
    ),
  )("ignore %s à la place de %s et laisse ce son", (_label, key, muted) => {
    stub.entries.set(STORAGE_KEY, JSON.stringify({ [key]: muted }));

    initSettings();

    expect(getSettings()[key]).toBe(false);
  });

  it("coupe un type de son sans couper l'autre ni le son général", () => {
    stub.entries.set(STORAGE_KEY, JSON.stringify({ musicMuted: true }));

    initSettings();

    expect(getSettings()).toMatchObject({ muted: false, effectsMuted: false, musicMuted: true });
  });

  it.each(["bw-trainer", "sv-kieran", "medley", "random"])(
    "relit la dernière musique choisie « %s »",
    (lastMusicId) => {
      stub.entries.set(STORAGE_KEY, JSON.stringify({ lastMusicId }));

      initSettings();

      expect(getSettings().lastMusicId).toBe(lastMusicId);
    },
  );

  it.each([
    ["une piste retirée du jeu", "retired-track"],
    ["le thème des menus", "menu"],
    ["une chaîne vide", ""],
    ["un nombre", 3],
    ["null", null],
  ])("ramène %s à « Aléatoire » comme dernière musique", (_label, lastMusicId) => {
    stub.entries.set(STORAGE_KEY, JSON.stringify({ lastMusicId, autoPlacement: false }));

    initSettings();

    expect(getSettings().lastMusicId).toBe("random");
    expect(getSettings().autoPlacement).toBe(false);
  });

  it("écrit les volumes, les sourdines par type et la musique choisie dans le magasin", () => {
    initSettings();

    updateSettings({ effectsVolume: 60, effectsMuted: true });
    updateSettings({ musicVolume: 25, musicMuted: true });
    updateSettings({ lastMusicId: "medley" });

    expect(JSON.parse(stub.entries.get(STORAGE_KEY) ?? "{}")).toMatchObject({
      effectsVolume: 60,
      effectsMuted: true,
      musicVolume: 25,
      musicMuted: true,
      lastMusicId: "medley",
    });
  });

  it("garde le volume de la musique quand on la coupe puis la remet", () => {
    initSettings();
    updateSettings({ musicVolume: 25 });

    updateSettings({ musicMuted: true });
    updateSettings({ musicMuted: false });

    expect(getSettings()).toMatchObject({ musicVolume: 25, musicMuted: false });
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
  const MASTER = DEFAULTS.volume / MAX_VOLUME;
  const MUSIC = DEFAULTS.musicVolume / MAX_VOLUME;

  beforeEach(() => {
    vi.mocked(initAudio).mockClear();
    vi.mocked(setAudioVolumes).mockClear();
  });

  it("ouvre l'audio aux volumes enregistrés, ramenés entre 0 et 1", () => {
    stub.entries.set(
      STORAGE_KEY,
      JSON.stringify({ volume: 40, effectsVolume: 80, musicVolume: 20 }),
    );

    initSettings();

    expect(initAudio).toHaveBeenCalledWith({ master: 0.4, effects: 0.8, music: 0.2 });
  });

  it("ouvre à zéro ce qui est coupé : tout le son, ou un seul type", () => {
    stub.entries.set(STORAGE_KEY, JSON.stringify({ volume: 40, muted: true, musicMuted: true }));

    initSettings();

    expect(initAudio).toHaveBeenCalledWith({ master: 0, effects: 1, music: 0 });
  });

  it("ouvre à zéro les seuls effets quand eux seuls sont coupés", () => {
    stub.entries.set(STORAGE_KEY, JSON.stringify({ effectsMuted: true }));

    initSettings();

    expect(initAudio).toHaveBeenCalledWith({ master: MASTER, effects: 0, music: MUSIC });
  });

  it("applique en direct le volume et la sourdine de chaque type, sans toucher à l'autre", () => {
    initSettings();

    updateSettings({ musicVolume: 20 });
    updateSettings({ musicMuted: true });
    updateSettings({ effectsVolume: 50 });
    updateSettings({ effectsMuted: true });
    updateSettings({ musicMuted: false });

    expect(vi.mocked(setAudioVolumes).mock.calls).toEqual([
      [{ master: MASTER, effects: 1, music: 0.2 }],
      [{ master: MASTER, effects: 1, music: 0 }],
      [{ master: MASTER, effects: 0.5, music: 0 }],
      [{ master: MASTER, effects: 0, music: 0 }],
      [{ master: MASTER, effects: 0, music: 0.2 }],
    ]);
  });

  it("applique en direct le volume, la sourdine, puis le volume retrouvé", () => {
    initSettings();

    updateSettings({ volume: 20 });
    updateSettings({ muted: true });
    updateSettings({ muted: false });

    expect(vi.mocked(setAudioVolumes).mock.calls).toEqual([
      [{ master: 0.2, effects: 1, music: 0.55 }],
      [{ master: 0, effects: 1, music: 0.55 }],
      [{ master: 0.2, effects: 1, music: 0.55 }],
    ]);
  });
});
