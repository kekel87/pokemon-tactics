import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BATTLE_MUSIC_TRACKS, MENU_MUSIC_TRACK, type MusicTrack } from "./music-track-table";

const MUSIC_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../public/assets/audio/music",
);

const ALL_TRACKS: readonly MusicTrack[] = [...BATTLE_MUSIC_TRACKS, MENU_MUSIC_TRACK];

function idsOf(tracks: readonly MusicTrack[]): string[] {
  return tracks.map((track) => track.id);
}

function hasNoPackedFile(track: MusicTrack): boolean {
  const file = join(MUSIC_DIRECTORY, `${track.id}.mp3`);
  return !existsSync(file) || statSync(file).size === 0;
}

describe("music track table", () => {
  it("gives every track, the menu theme included, an id of its own", () => {
    const ids = idsOf(ALL_TRACKS);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("loops every track between two ordered, whole points", () => {
    const broken = ALL_TRACKS.filter(
      (track) =>
        !Number.isInteger(track.loopStartMs) ||
        !Number.isInteger(track.loopEndMs) ||
        track.loopStartMs < 0 ||
        track.loopEndMs <= track.loopStartMs,
    );

    expect(idsOf(broken)).toEqual([]);
  });

  it("names every track in kebab-case: an id is a file name and a key", () => {
    const misnamed = ALL_TRACKS.filter((track) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(track.id));

    expect(idsOf(misnamed)).toEqual([]);
  });

  it("has a source to fetch every track from", () => {
    const sourceless = ALL_TRACKS.filter((track) => !/^https:\/\/.+\.mp3$/.test(track.sourceUrl));

    expect(idsOf(sourceless)).toEqual([]);
  });

  it("ships the packed file of every track", () => {
    expect(idsOf(ALL_TRACKS.filter(hasNoPackedFile))).toEqual([]);
  });
});
