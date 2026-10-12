import { createPrng } from "@pokemon-tactic/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BATTLE_MUSIC_TRACKS, MENU_MUSIC_TRACK, MENU_MUSIC_TRACKS } from "./music-track-table";
import {
  createMedleyOrder,
  findBattleTrack,
  knownMenuMusicIdOrDefault,
  knownMusicIdOrDefault,
  MEDLEY_MUSIC_ID,
  MENU_THEME_MUSIC_ID,
  menuTrackOf,
  RANDOM_MUSIC_ID,
  resolveMusicId,
} from "./music-tracks";

const MENU_THEME_IDS: readonly string[] = MENU_MUSIC_TRACKS.map((track) => track.id);
const NOT_A_MENU_THEME = [
  "bw-trainer",
  "sv-kieran",
  MEDLEY_MUSIC_ID,
  RANDOM_MUSIC_ID,
  "retired-theme",
  "FRLG-TITLE",
  "",
];

const TRACK_IDS: readonly string[] = BATTLE_MUSIC_TRACKS.map((track) => track.id);
const SORTED_TRACK_IDS: readonly string[] = [...TRACK_IDS].sort();
const TRACK_COUNT = BATTLE_MUSIC_TRACKS.length;
const SEEDS = [1, 7, 42, 2026, 123456789];
const KEEP_IN_PLACE = 0.999999;
const SWAP_WITH_FIRST = 0;

function drawIds(nextTrack: ReturnType<typeof createMedleyOrder>, count: number): string[] {
  return Array.from({ length: count }, () => nextTrack()?.id ?? "<none>");
}

vi.mock("@pokemon-tactic/network", () => ({ RANDOM_MUSIC_ID: "random" }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("findBattleTrack", () => {
  it("finds a track of the table by its id", () => {
    expect(findBattleTrack("bw-trainer")?.id).toBe("bw-trainer");
  });

  it.each([RANDOM_MUSIC_ID, MEDLEY_MUSIC_ID, "menu", "frlg-title", "retired-track", ""])(
    "finds no battle track for « %s »",
    (musicId) => {
      expect(findBattleTrack(musicId)).toBeUndefined();
    },
  );
});

describe("knownMusicIdOrDefault", () => {
  it.each(["sv-kieran", MEDLEY_MUSIC_ID, RANDOM_MUSIC_ID])("keeps « %s »", (musicId) => {
    expect(knownMusicIdOrDefault(musicId)).toBe(musicId);
  });

  it.each(["retired-track", "menu", "frlg-title", "", "BW-TRAINER"])(
    "brings the unknown id « %s » back to the random entry",
    (musicId) => {
      expect(knownMusicIdOrDefault(musicId)).toBe(RANDOM_MUSIC_ID);
    },
  );
});

describe("menuTrackOf", () => {
  it("finds every menus' theme by its id", () => {
    expect(MENU_THEME_IDS.map((musicId) => menuTrackOf(musicId).id)).toEqual(MENU_THEME_IDS);
  });

  it.each(NOT_A_MENU_THEME)("falls back on the default theme for « %s »", (musicId) => {
    expect(menuTrackOf(musicId)).toBe(MENU_MUSIC_TRACK);
  });
});

describe("knownMenuMusicIdOrDefault", () => {
  it("keeps a menus' theme", () => {
    expect(knownMenuMusicIdOrDefault("rs-center")).toBe("rs-center");
  });

  it("brings an id that is not a menus' theme back to the default one", () => {
    expect(knownMenuMusicIdOrDefault("bw-trainer")).toBe(MENU_THEME_MUSIC_ID);
  });
});

describe("resolveMusicId", () => {
  it("draws a track of the table for the random entry, from its first to its last", () => {
    const random = vi.spyOn(Math, "random");
    const draws = [0, 0.5, KEEP_IN_PLACE];

    const resolved = draws.map((draw) => {
      random.mockReturnValueOnce(draw);
      return resolveMusicId(RANDOM_MUSIC_ID);
    });

    expect(resolved).toEqual([
      TRACK_IDS[0],
      TRACK_IDS[Math.floor(TRACK_COUNT / 2)],
      TRACK_IDS.at(-1),
    ]);
  });

  it("leaves a track id as it is, without drawing", () => {
    const random = vi.spyOn(Math, "random");

    expect(resolveMusicId("xy-gym")).toBe("xy-gym");
    expect(random).not.toHaveBeenCalled();
  });

  it("leaves the medley as it is: its tracks are drawn as the battle plays", () => {
    expect(resolveMusicId(MEDLEY_MUSIC_ID)).toBe(MEDLEY_MUSIC_ID);
  });

  it("leaves an id it does not know as it is", () => {
    expect(resolveMusicId("retired-track")).toBe("retired-track");
  });
});

describe("createMedleyOrder", () => {
  it.each(SEEDS)("plays every track exactly once per round (seed %i)", (seed) => {
    const nextTrack = createMedleyOrder(createPrng(seed));

    for (let round = 0; round < 4; round += 1) {
      const ids = drawIds(nextTrack, TRACK_COUNT);

      expect([...ids].sort()).toEqual(SORTED_TRACK_IDS);
    }
  });

  it.each(SEEDS)(
    "never plays the same track twice in a row, also across two rounds (seed %i)",
    (seed) => {
      const ids = drawIds(createMedleyOrder(createPrng(seed)), TRACK_COUNT * 40);

      for (let index = 1; index < ids.length; index += 1) {
        expect(ids[index], `draw ${index}`).not.toBe(ids[index - 1]);
      }
    },
  );

  it("moves the first track of a round to its end when the shuffle opens on the one that just played", () => {
    const draws: number[] = [
      ...Array.from({ length: TRACK_COUNT - 1 }, () => KEEP_IN_PLACE),
      SWAP_WITH_FIRST,
      ...Array.from({ length: TRACK_COUNT - 2 }, () => KEEP_IN_PLACE),
    ];
    const nextTrack = createMedleyOrder(() => draws.shift() ?? KEEP_IN_PLACE);

    const firstRound = drawIds(nextTrack, TRACK_COUNT);
    const secondRound = drawIds(nextTrack, TRACK_COUNT);

    expect(firstRound).toEqual(TRACK_IDS);
    expect(secondRound[0]).not.toBe(firstRound.at(-1));
    expect(secondRound.at(-1)).toBe(firstRound.at(-1));
    expect([...secondRound].sort()).toEqual(SORTED_TRACK_IDS);
  });

  it("gives the same order for the same seed", () => {
    const first = drawIds(createMedleyOrder(createPrng(2026)), TRACK_COUNT * 3);
    const second = drawIds(createMedleyOrder(createPrng(2026)), TRACK_COUNT * 3);

    expect(second).toEqual(first);
  });

  it("gives another order for another seed", () => {
    const first = drawIds(createMedleyOrder(createPrng(1)), TRACK_COUNT);
    const second = drawIds(createMedleyOrder(createPrng(2)), TRACK_COUNT);

    expect(second).not.toEqual(first);
  });

  it("returns tracks of the table, loop points included", () => {
    const track = createMedleyOrder(createPrng(5))();

    expect(BATTLE_MUSIC_TRACKS).toContain(track);
  });
});
