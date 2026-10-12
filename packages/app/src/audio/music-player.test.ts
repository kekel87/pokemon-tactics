import { createPrng } from "@pokemon-tactic/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeMusicEngine } from "../testing/fake-music-engine";
import { MusicBus } from "./audio-player";
import {
  BATTLE_MUSIC_TRACKS,
  MENU_MUSIC_TRACK,
  MENU_MUSIC_TRACKS,
  type MusicTrack,
} from "./music-track-table";
import { createMedleyOrder, MEDLEY_MUSIC_ID } from "./music-tracks";

let engine: FakeMusicEngine;

vi.mock("@pokemon-tactic/network", () => ({ RANDOM_MUSIC_ID: "random" }));

vi.mock("./audio-player", () => ({
  MusicBus: { Battle: "battle", Menu: "menu" },
  isMusicAudible: (bus: MusicBus) => engine.isAudible(bus),
  isMusicWanted: (bus: MusicBus) => engine.isWanted(bus),
  musicOutput: () => engine.output(),
  onMusicAudible: (listener: () => void) => {
    engine.audibleListener = listener;
  },
}));

function trackUrl(id: string): string {
  return `assets/audio/music/${id}.mp3`;
}

function menuTheme(matches: (track: MusicTrack) => boolean): MusicTrack {
  const theme = MENU_MUSIC_TRACKS.find(matches);
  if (theme === undefined) {
    throw new Error("the table has no such menus' theme");
  }
  return theme;
}

const MENU_URL = trackUrl(MENU_MUSIC_TRACK.id);
const LOOPED_THEME = menuTheme((track) => track.restartAtMs === undefined);
const LOOPED_THEME_URL = trackUrl(LOOPED_THEME.id);
const ALBUM_THEME = menuTheme((track) => track.restartAtMs !== undefined);
const ALBUM_URL = trackUrl(ALBUM_THEME.id);
const ALBUM_RESTART_SECONDS = (ALBUM_THEME.restartAtMs ?? 0) / 1000;
const OTHER_THEME = menuTheme((track) => track.id !== MENU_MUSIC_TRACK.id);
const ALBUM_CROSSFADE_SECONDS = 3;
const TRACK = BATTLE_MUSIC_TRACKS[4];
const TRACK_URL = trackUrl(TRACK.id);
const OTHER_TRACK = BATTLE_MUSIC_TRACKS[9];
const MEDLEY_SEED = 2026;
const STOP_FADE_SECONDS = 0.5;
const DUCK_RELEASE_SECONDS = 0.3;
const PAUSED_LEVEL = 0.4;
const BATTLE_OVER_LEVEL = 0.3;
const MEDLEY_POLL_MS = 1000;
const ENTRY_TIMER_MS = 1;
const MEDLEY_CROSSFADE_SECONDS = 1.5;
const MEDLEY_RETRY_SECONDS = 30;
const LONG_AFTER_ANY_TRACK_SECONDS = 100_000;

describe("music player", () => {
  let player: typeof import("./music-player");

  const settle = async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(0);
  };

  const random = (): number => 0;

  const playTrack = async (): Promise<void> => {
    player.playBattleMusic(TRACK.id, random);
    await settle();
  };

  const createMixerWithoutMusic = (): void => {
    player.setMusicDim(player.MusicDim.Paused, true);
    player.setMusicDim(player.MusicDim.Paused, false);
  };

  beforeEach(async () => {
    engine = new FakeMusicEngine();
    vi.useFakeTimers();
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("fetch", engine.fetch);
    vi.resetModules();
    player = await import("./music-player");
  });

  afterEach(() => {
    player.stopMusic();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("menu theme", () => {
    it("fetches a theme with loop points and loops it whole", async () => {
      player.playMenuMusic(LOOPED_THEME.id);
      await settle();

      expect(engine.fetched).toEqual([LOOPED_THEME_URL]);
      expect(engine.sources).toHaveLength(1);
      expect(engine.sources[0]).toMatchObject({
        loop: true,
        loopStart: 0,
        loopEnd: LOOPED_THEME.loopEndMs / 1000,
        startedAt: 0,
      });
    });

    it("plays on the menus' bus, a battle track on the battles'", async () => {
      player.playMenuMusic(MENU_MUSIC_TRACK.id);
      await settle();
      await playTrack();

      expect(engine.sources.map((source) => engine.busOf(source))).toEqual([
        MusicBus.Menu,
        MusicBus.Battle,
      ]);
    });

    it("starts the new theme when the player picks another", async () => {
      player.playMenuMusic(MENU_MUSIC_TRACK.id);
      await settle();
      engine.now = 12;

      player.playMenuMusic(OTHER_THEME.id);
      await settle();

      expect(engine.fetched).toEqual([MENU_URL, trackUrl(OTHER_THEME.id)]);
      expect(engine.sources[0]?.stoppedAt).toBe(12 + STOP_FADE_SECONDS);
      expect(engine.sources[1]?.startedAt).toBe(12);
    });

    it("plays the default theme for an id that is not a menus' theme, and keeps it playing", async () => {
      player.playMenuMusic(TRACK.id);
      await settle();

      player.playMenuMusic(MENU_MUSIC_TRACK.id);
      await settle();

      expect(engine.fetched).toEqual([MENU_URL]);
      expect(engine.sources[0]?.stoppedAt).toBeNull();
    });

    it("runs on from a menu screen to the next without starting over", async () => {
      player.playMenuMusic(MENU_MUSIC_TRACK.id);
      await settle();

      player.playMenuMusic(MENU_MUSIC_TRACK.id);
      await settle();

      expect(engine.fetched).toEqual([MENU_URL]);
      expect(engine.sources[0]?.stoppedAt).toBeNull();
    });

    it("comes back after a battle", async () => {
      await playTrack();

      player.playMenuMusic(MENU_MUSIC_TRACK.id);
      await settle();

      expect(engine.fetched).toEqual([TRACK_URL, MENU_URL]);
      expect(engine.sources[0]?.stoppedAt).toBe(STOP_FADE_SECONDS);
    });

    it("tries again at the next screen when the theme would not load", async () => {
      engine.failing.add(MENU_URL);
      player.playMenuMusic(MENU_MUSIC_TRACK.id);
      await settle();
      engine.failing.clear();

      player.playMenuMusic(MENU_MUSIC_TRACK.id);
      await settle();

      expect(engine.fetched).toEqual([MENU_URL, MENU_URL]);
      expect(engine.sources).toHaveLength(1);
    });
  });

  describe("album track", () => {
    beforeEach(async () => {
      player.playMenuMusic(ALBUM_THEME.id);
      await settle();
    });

    it("plays through instead of looping", () => {
      expect(engine.sources[0]).toMatchObject({ loop: false, startedAt: 0 });
    });

    it("plays on until its restart point", async () => {
      engine.now = ALBUM_RESTART_SECONDS - 1;
      await vi.advanceTimersByTimeAsync(MEDLEY_POLL_MS * 3);

      expect(engine.sources).toHaveLength(1);
      expect(engine.sources[0]?.stoppedAt).toBeNull();
    });

    it("starts over under its own end fading out, without fetching it again", async () => {
      engine.now = ALBUM_RESTART_SECONDS;
      await vi.advanceTimersByTimeAsync(MEDLEY_POLL_MS);

      expect(engine.fetched).toEqual([ALBUM_URL]);
      expect(engine.sources).toHaveLength(2);
      expect(engine.sources[0]?.stoppedAt).toBe(ALBUM_RESTART_SECONDS + ALBUM_CROSSFADE_SECONDS);
      expect(engine.sources[1]).toMatchObject({ loop: false, startedAt: ALBUM_RESTART_SECONDS });
      expect(engine.busOf(engine.sources[1])).toBe(MusicBus.Menu);
    });

    it("starts over again one restart point after the last", async () => {
      engine.now = ALBUM_RESTART_SECONDS;
      await vi.advanceTimersByTimeAsync(MEDLEY_POLL_MS);

      engine.now = ALBUM_RESTART_SECONDS * 2 - 1;
      await vi.advanceTimersByTimeAsync(MEDLEY_POLL_MS);
      expect(engine.sources).toHaveLength(2);

      engine.now = ALBUM_RESTART_SECONDS * 2;
      await vi.advanceTimersByTimeAsync(MEDLEY_POLL_MS);
      expect(engine.sources).toHaveLength(3);
    });

    it("stops starting over once stopped", async () => {
      player.stopMusic();

      engine.now = ALBUM_RESTART_SECONDS;
      await vi.advanceTimersByTimeAsync(MEDLEY_POLL_MS * 3);

      expect(engine.sources).toHaveLength(1);
      expect(engine.sources[0]?.stoppedAt).toBe(STOP_FADE_SECONDS);
    });
  });

  describe("preloadMusic", () => {
    it("loads the menus' theme ahead, and the programme plays that one load", async () => {
      await player.preloadMusic(MusicBus.Menu, MENU_MUSIC_TRACK.id);
      expect(engine.sources).toEqual([]);

      player.playMenuMusic(MENU_MUSIC_TRACK.id);
      await settle();

      expect(engine.fetched).toEqual([MENU_URL]);
      expect(engine.sources).toHaveLength(1);
    });

    it("waits on the load the programme already asked for", async () => {
      player.playBattleMusic(TRACK.id, random);

      await player.preloadMusic(MusicBus.Battle, TRACK.id);
      await settle();

      expect(engine.fetched).toEqual([TRACK_URL]);
      expect(engine.sources).toHaveLength(1);
    });

    it("keeps one load of a track asked for twice before it plays", async () => {
      await player.preloadMusic(MusicBus.Battle, TRACK.id);
      await player.preloadMusic(MusicBus.Battle, TRACK.id);

      expect(engine.fetched).toEqual([TRACK_URL]);
    });

    it("lets go of the track once the programme has it: asking again loads again", async () => {
      await player.preloadMusic(MusicBus.Battle, TRACK.id);
      await playTrack();

      await player.preloadMusic(MusicBus.Battle, TRACK.id);

      expect(engine.fetched).toEqual([TRACK_URL, TRACK_URL]);
    });

    it.each([
      [MusicBus.Menu, MENU_MUSIC_TRACK.id],
      [MusicBus.Battle, TRACK.id],
    ])("loads nothing for the « %s » music the player has silenced", async (bus, musicId) => {
      engine.unwanted.add(bus);

      await player.preloadMusic(bus, musicId);

      expect(engine.fetched).toEqual([]);
    });

    it("loads the music still wanted while the other kind is silenced", async () => {
      engine.unwanted.add(MusicBus.Menu);

      await player.preloadMusic(MusicBus.Battle, TRACK.id);

      expect(engine.fetched).toEqual([TRACK_URL]);
    });

    it("loads a wanted track before any gesture has unlocked the audio", async () => {
      engine.inaudible.add(MusicBus.Menu);

      await player.preloadMusic(MusicBus.Menu, MENU_MUSIC_TRACK.id);

      expect(engine.fetched).toEqual([MENU_URL]);
    });

    it.each([MEDLEY_MUSIC_ID, "retired-track"])(
      "loads nothing for the battle choice « %s », which names no track",
      async (musicId) => {
        await player.preloadMusic(MusicBus.Battle, musicId);

        expect(engine.fetched).toEqual([]);
      },
    );

    it("loads the default theme for a menus' choice that is not a theme", async () => {
      await player.preloadMusic(MusicBus.Menu, TRACK.id);

      expect(engine.fetched).toEqual([MENU_URL]);
    });

    it("resolves without an audio engine, loading nothing", async () => {
      engine.available = false;

      await expect(
        player.preloadMusic(MusicBus.Menu, MENU_MUSIC_TRACK.id),
      ).resolves.toBeUndefined();
      expect(engine.fetched).toEqual([]);
    });

    it("resolves when the track will not load, and does not keep the failure", async () => {
      engine.failing.add(TRACK_URL);
      await expect(player.preloadMusic(MusicBus.Battle, TRACK.id)).resolves.toBeUndefined();
      engine.failing.clear();

      await playTrack();

      expect(engine.fetched).toEqual([TRACK_URL, TRACK_URL]);
      expect(engine.sources).toHaveLength(1);
    });
  });

  describe("battle track", () => {
    it("loops a track between its loop points, fading in from silence", async () => {
      await playTrack();

      expect(engine.fetched).toEqual([TRACK_URL]);
      expect(engine.sources[0]).toMatchObject({
        loop: true,
        loopStart: TRACK.loopStartMs / 1000,
        loopEnd: TRACK.loopEndMs / 1000,
        startedAt: 0,
      });
      expect(engine.sources[0]?.output?.calls[0]).toMatchObject({
        method: "setValueAtTime",
        level: 0,
      });
      expect(engine.sources[0]?.output?.targets().at(-1)?.level).toBe(1);
    });

    it("starts anew when the same track is asked for again", async () => {
      await playTrack();

      await playTrack();

      expect(engine.fetched).toEqual([TRACK_URL, TRACK_URL]);
      expect(engine.sources[0]?.stoppedAt).toBe(STOP_FADE_SECONDS);
      expect(engine.sources[1]?.startedAt).toBe(0);
    });

    it("plays nothing for an id it does not know, and stops what was playing", async () => {
      player.playMenuMusic(MENU_MUSIC_TRACK.id);
      await settle();

      player.playBattleMusic("retired-track", random);
      await settle();

      expect(engine.fetched).toEqual([MENU_URL]);
      expect(engine.sources[0]?.stoppedAt).toBe(STOP_FADE_SECONDS);
    });

    it("never starts a track whose battle was left while it was loading", async () => {
      player.playBattleMusic(TRACK.id, random);
      player.stopMusic();
      await settle();

      expect(engine.sources).toEqual([]);
    });

    it("fetches nothing without an audio engine", async () => {
      engine.available = false;

      await playTrack();

      expect(engine.fetched).toEqual([]);
    });
  });

  describe("while the music cannot be heard", () => {
    it("fetches nothing, then starts the moment it becomes audible", async () => {
      engine.inaudible.add(MusicBus.Battle);
      await playTrack();
      expect(engine.fetched).toEqual([]);

      engine.inaudible.clear();
      engine.audibleListener?.();
      await settle();

      expect(engine.fetched).toEqual([TRACK_URL]);
      expect(engine.sources).toHaveLength(1);
    });

    it("starts the waiting programme once, however often it becomes audible", async () => {
      engine.inaudible.add(MusicBus.Battle);
      player.playBattleMusic(TRACK.id, random);
      engine.inaudible.clear();

      engine.audibleListener?.();
      engine.audibleListener?.();
      await settle();

      expect(engine.fetched).toEqual([TRACK_URL]);
    });

    it("wakes a waiting programme for its own kind of music only", async () => {
      engine.inaudible.add(MusicBus.Menu);
      player.playMenuMusic(MENU_MUSIC_TRACK.id);

      engine.audibleListener?.();
      await settle();
      expect(engine.fetched).toEqual([]);

      engine.inaudible.clear();
      engine.audibleListener?.();
      await settle();
      expect(engine.fetched).toEqual([MENU_URL]);
    });

    it("plays a battle track while the menus' music is silenced", async () => {
      engine.unwanted.add(MusicBus.Menu);

      await playTrack();

      expect(engine.sources).toHaveLength(1);
    });

    it("starts nothing when the programme was stopped while waiting", async () => {
      engine.inaudible.add(MusicBus.Battle);
      player.playBattleMusic(TRACK.id, random);
      player.stopMusic();
      engine.inaudible.clear();

      engine.audibleListener?.();
      await settle();

      expect(engine.fetched).toEqual([]);
    });
  });

  describe("stopBattleMusic", () => {
    it("fades a battle's track out", async () => {
      await playTrack();
      engine.now = 10;

      player.stopBattleMusic();

      expect(engine.sources[0]?.stoppedAt).toBe(10 + STOP_FADE_SECONDS);
      expect(engine.sources[0]?.output?.targets().at(-1)).toEqual({ level: 0, at: 10 });
    });

    it("leaves the menu theme alone: a combat screen torn down late must not cut it", async () => {
      player.playMenuMusic(MENU_MUSIC_TRACK.id);
      await settle();

      player.stopBattleMusic();

      expect(engine.sources[0]?.stoppedAt).toBeNull();
    });
  });

  describe("duckMusic", () => {
    it("lowers the music to the level, then lets it back up once the cry is over", async () => {
      await playTrack();
      engine.now = 20;

      player.duckMusic(0.5, 900);

      expect(engine.duck.targets()).toEqual([
        { level: 0.5, at: 20 },
        { level: 1, at: 20.9 },
      ]);
    });

    it("extends a duck at the lower of two levels, without coming up in between", async () => {
      await playTrack();
      engine.now = 20;
      player.duckMusic(0.5, 900);
      engine.now = 20.5;

      player.duckMusic(0.7, 1000);

      expect(engine.duck.targets().slice(2)).toEqual([
        { level: 0.5, at: 20.5 },
        { level: 1, at: 21.5 },
      ]);
      expect(engine.duck.calls.filter((call) => call.method === "cancelScheduledValues")).toEqual([
        { method: "cancelScheduledValues", at: 20 },
        { method: "cancelScheduledValues", at: 20.5 },
      ]);
    });

    it("keeps the longer of two ducks: a short cry during a long one does not cut it short", async () => {
      await playTrack();
      engine.now = 20;
      player.duckMusic(0.5, 2000);
      engine.now = 20.5;

      player.duckMusic(0.5, 300);

      expect(engine.duck.targets().at(-1)).toEqual({ level: 1, at: 22 });
    });

    it("takes the new level once the previous duck has fully released", async () => {
      await playTrack();
      engine.now = 20;
      player.duckMusic(0.5, 900);
      engine.now = 20.9 + DUCK_RELEASE_SECONDS;

      player.duckMusic(0.7, 500);

      expect(engine.duck.targets().slice(2)).toEqual([
        { level: 0.7, at: engine.now },
        { level: 1, at: engine.now + 0.5 },
      ]);
    });

    it("never lowers the menus' music: a cry leans on the battle's", async () => {
      player.playMenuMusic(MENU_MUSIC_TRACK.id);
      await settle();
      engine.now = 20;

      player.duckMusic(0.5, 900);

      expect(engine.duck.calls).toEqual([]);
    });

    it("does nothing when no music is playing", () => {
      createMixerWithoutMusic();

      player.duckMusic(0.5, 900);

      expect(engine.duck.calls).toEqual([]);
    });
  });

  describe("setMusicDim", () => {
    it("holds the music down while the pause menu is open, and lets it back up", async () => {
      await playTrack();

      player.setMusicDim(player.MusicDim.Paused, true);
      player.setMusicDim(player.MusicDim.Paused, false);

      expect(engine.dim.targets()).toEqual([
        { level: PAUSED_LEVEL, at: 0 },
        { level: 1, at: 0 },
      ]);
    });

    it("keeps the lowest level of the reasons that hold", async () => {
      await playTrack();

      player.setMusicDim(player.MusicDim.BattleOver, true);
      player.setMusicDim(player.MusicDim.Paused, true);
      player.setMusicDim(player.MusicDim.BattleOver, false);

      expect(engine.dim.targets().map((target) => target.level)).toEqual([
        BATTLE_OVER_LEVEL,
        BATTLE_OVER_LEVEL,
        PAUSED_LEVEL,
      ]);
    });

    it("ignores a reason set twice", async () => {
      await playTrack();

      player.setMusicDim(player.MusicDim.Paused, true);
      player.setMusicDim(player.MusicDim.Paused, true);

      expect(engine.dim.targets()).toHaveLength(1);
    });

    it("lets the bus back up after the fade when the programme stops, so the next is not held down", async () => {
      await playTrack();
      player.setMusicDim(player.MusicDim.BattleOver, true);
      engine.now = 30;

      player.stopMusic();
      player.setMusicDim(player.MusicDim.BattleOver, true);

      expect(engine.dim.targets().slice(1)).toEqual([
        { level: 1, at: 30 + STOP_FADE_SECONDS },
        { level: BATTLE_OVER_LEVEL, at: 30 },
      ]);
    });
  });

  describe("medley", () => {
    const expectedUrls = (count: number): string[] => {
      const nextTrack = createMedleyOrder(createPrng(MEDLEY_SEED));
      return Array.from({ length: count }, () => trackUrl(nextTrack()?.id ?? "<none>"));
    };

    beforeEach(async () => {
      player.playBattleMusic(MEDLEY_MUSIC_ID, createPrng(MEDLEY_SEED));
      await settle();
    });

    it("opens on the first track of the order drawn from its seed", async () => {
      expect(engine.fetched).toEqual(expectedUrls(1));
      expect(engine.sources).toHaveLength(1);
    });

    it("lets the playing track loop on until it is about to give way", async () => {
      engine.now = 60;
      await vi.advanceTimersByTimeAsync(MEDLEY_POLL_MS * 3);

      expect(engine.fetched).toHaveLength(1);
    });

    it("crossfades into the next track of the order once the playing one has run its length", async () => {
      engine.now = LONG_AFTER_ANY_TRACK_SECONDS;
      await vi.advanceTimersByTimeAsync(MEDLEY_POLL_MS + ENTRY_TIMER_MS);

      expect(engine.fetched).toEqual(expectedUrls(2));
      expect(engine.sources).toHaveLength(2);
      expect(engine.sources[0]?.stoppedAt).toBe(
        LONG_AFTER_ANY_TRACK_SECONDS + MEDLEY_CROSSFADE_SECONDS,
      );
      expect(engine.sources[1]?.startedAt).toBe(LONG_AFTER_ANY_TRACK_SECONDS);
    });

    it("holds its next track back while the music cannot be heard", async () => {
      engine.inaudible.add(MusicBus.Battle);

      engine.now = LONG_AFTER_ANY_TRACK_SECONDS;
      await vi.advanceTimersByTimeAsync(MEDLEY_POLL_MS * 3);

      expect(engine.fetched).toHaveLength(1);
    });

    it("keeps the playing track and waits before another try when the next will not load", async () => {
      const [, second, third] = expectedUrls(3);
      engine.failing.add(second ?? "");

      engine.now = LONG_AFTER_ANY_TRACK_SECONDS;
      await vi.advanceTimersByTimeAsync(MEDLEY_POLL_MS * 3);
      expect(engine.fetched).toHaveLength(2);
      expect(engine.sources[0]?.stoppedAt).toBeNull();

      engine.now += MEDLEY_RETRY_SECONDS - 1;
      await vi.advanceTimersByTimeAsync(MEDLEY_POLL_MS);
      expect(engine.fetched).toHaveLength(2);

      engine.now += 1;
      await vi.advanceTimersByTimeAsync(MEDLEY_POLL_MS);
      expect(engine.fetched.at(-1)).toBe(third);
    });

    it("stops following its order once stopped", async () => {
      player.stopMusic();
      engine.now = LONG_AFTER_ANY_TRACK_SECONDS;
      await vi.advanceTimersByTimeAsync(MEDLEY_POLL_MS * 3);

      expect(engine.fetched).toHaveLength(1);
      expect(engine.sources[0]?.stoppedAt).toBe(STOP_FADE_SECONDS);
    });

    it("gives way to a single track asked for next", async () => {
      player.playBattleMusic(OTHER_TRACK.id, random);
      await settle();

      engine.now = LONG_AFTER_ANY_TRACK_SECONDS;
      await vi.advanceTimersByTimeAsync(MEDLEY_POLL_MS * 3);

      expect(engine.fetched.at(-1)).toBe(trackUrl(OTHER_TRACK.id));
      expect(engine.fetched).toHaveLength(2);
    });
  });
});
