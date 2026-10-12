import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BATTLE_MUSIC_TRACKS,
  MENU_MUSIC_TRACK,
  MENU_MUSIC_TRACKS,
  type MusicTrack,
} from "./music-track-table";

const MUSIC_DIRECTORY = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../public/assets/audio/music",
);

const ALL_TRACKS: readonly MusicTrack[] = [...BATTLE_MUSIC_TRACKS, ...MENU_MUSIC_TRACKS];

function isAlbumTrack(track: MusicTrack): boolean {
  return track.restartAtMs !== undefined;
}

const ALBUM_TRACKS = ALL_TRACKS.filter(isAlbumTrack);

function idsOf(tracks: readonly MusicTrack[]): string[] {
  return tracks.map((track) => track.id);
}

function hasNoPackedFile(track: MusicTrack): boolean {
  const file = join(MUSIC_DIRECTORY, `${track.id}.mp3`);
  return !existsSync(file) || statSync(file).size === 0;
}

describe("music track table", () => {
  it("gives every track, the menus' themes included, an id of its own", () => {
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

  it("has the menus' default theme first in their list", () => {
    expect(MENU_MUSIC_TRACKS[0]).toBe(MENU_MUSIC_TRACK);
  });

  it("keeps the battle tracks free of album tracks: a medley gives way on loop points", () => {
    expect(idsOf(BATTLE_MUSIC_TRACKS.filter(isAlbumTrack))).toEqual([]);
  });

  it("starts every album track over at a whole point before its end", () => {
    const broken = ALBUM_TRACKS.filter(
      ({ restartAtMs = 0, loopEndMs }) =>
        !Number.isInteger(restartAtMs) || restartAtMs <= 0 || restartAtMs >= loopEndMs,
    );

    expect(ALBUM_TRACKS.length).toBeGreaterThan(0);
    expect(idsOf(broken)).toEqual([]);
  });

  it("plays every album track from its very start", () => {
    expect(idsOf(ALBUM_TRACKS.filter((track) => track.loopStartMs !== 0))).toEqual([]);
  });
});
