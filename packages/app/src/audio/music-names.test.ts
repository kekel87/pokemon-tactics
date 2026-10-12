import { describe, expect, it, vi } from "vitest";
import { LOCALES } from "../i18n/locales";
import { Language } from "../i18n/types";
import { musicDisplayName } from "./music-names";
import { BATTLE_MUSIC_TRACKS, MENU_MUSIC_TRACKS } from "./music-track-table";
import { MEDLEY_MUSIC_ID, RANDOM_MUSIC_ID } from "./music-tracks";

vi.mock("@pokemon-tactic/network", () => ({ RANDOM_MUSIC_ID: "random" }));
vi.mock("../i18n", () => ({ t: (key: string) => `t(${key})` }));

describe("musicDisplayName", () => {
  it("labels a track by its own translation key", () => {
    expect(musicDisplayName("bw-trainer")).toBe("t(music.track.bw-trainer)");
  });

  it("labels the random entry", () => {
    expect(musicDisplayName(RANDOM_MUSIC_ID)).toBe("t(music.random)");
  });

  it("labels the medley", () => {
    expect(musicDisplayName(MEDLEY_MUSIC_ID)).toBe("t(music.medley)");
  });

  it("labels a menus' theme by its own translation key", () => {
    expect(musicDisplayName("rs-center")).toBe("t(music.menu.rs-center)");
  });

  it.each(["retired-track", "retired-theme", ""])(
    "shows the unknown id « %s » as it came, untranslated",
    (musicId) => {
      expect(musicDisplayName(musicId)).toBe(musicId);
    },
  );
});

describe.each([
  ["battle track", BATTLE_MUSIC_TRACKS.map((track) => `music.track.${track.id}` as const)],
  ["menus' theme", MENU_MUSIC_TRACKS.map((track) => `music.menu.${track.id}` as const)],
])("%s labels", (_kind, keys) => {
  it.each(Object.values(Language))("gives each a label of its own in « %s »", (language) => {
    const translations = LOCALES[language];
    const labels = keys.map((key) => translations[key]);

    expect(labels.every((label) => label !== undefined && label.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
