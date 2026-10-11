import { createPrng } from "@pokemon-tactic/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeMusicEngine } from "../testing/fake-music-engine";
import { BATTLE_MUSIC_TRACKS } from "./music-track-table";
import { createMedleyOrder, MEDLEY_MUSIC_ID } from "./music-tracks";

const engine = new FakeMusicEngine();

vi.mock("@pokemon-tactic/network", () => ({ RANDOM_MUSIC_ID: "random" }));

vi.mock("./audio-player", () => ({
  isMusicAudible: () => engine.audible,
  musicOutput: () => (engine.available ? { context: engine.context, node: engine.busNode } : null),
  onMusicAudible: (listener: () => void) => {
    engine.audibleListener = listener;
  },
}));

function trackUrl(id: string): string {
  return `assets/audio/music/${id}.mp3`;
}

const MENU_URL = trackUrl("menu");
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
    engine.reset();
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
    it("fetches the menu theme and loops it whole", async () => {
      player.playMenuMusic();
      await settle();

      expect(engine.fetched).toEqual([MENU_URL]);
      expect(engine.sources).toHaveLength(1);
      expect(engine.sources[0]).toMatchObject({ loop: true, loopStart: 0, startedAt: 0 });
    });

    it("runs on from a menu screen to the next without starting over", async () => {
      player.playMenuMusic();
      await settle();

      player.playMenuMusic();
      await settle();

      expect(engine.fetched).toEqual([MENU_URL]);
      expect(engine.sources[0]?.stoppedAt).toBeNull();
    });

    it("comes back after a battle", async () => {
      await playTrack();

      player.playMenuMusic();
      await settle();

      expect(engine.fetched).toEqual([TRACK_URL, MENU_URL]);
      expect(engine.sources[0]?.stoppedAt).toBe(STOP_FADE_SECONDS);
    });

    it("tries again at the next screen when the theme would not load", async () => {
      engine.failing.add(MENU_URL);
      player.playMenuMusic();
      await settle();
      engine.failing.clear();

      player.playMenuMusic();
      await settle();

      expect(engine.fetched).toEqual([MENU_URL, MENU_URL]);
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
      expect(engine.gains[2]?.calls[0]).toMatchObject({ method: "setValueAtTime", level: 0 });
      expect(engine.gains[2]?.targets().at(-1)?.level).toBe(1);
    });

    it("starts anew when the same track is asked for again", async () => {
      await playTrack();

      await playTrack();

      expect(engine.fetched).toEqual([TRACK_URL, TRACK_URL]);
      expect(engine.sources[0]?.stoppedAt).toBe(STOP_FADE_SECONDS);
      expect(engine.sources[1]?.startedAt).toBe(0);
    });

    it("plays nothing for an id it does not know, and stops what was playing", async () => {
      player.playMenuMusic();
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
      engine.audible = false;
      await playTrack();
      expect(engine.fetched).toEqual([]);

      engine.audible = true;
      engine.audibleListener?.();
      await settle();

      expect(engine.fetched).toEqual([TRACK_URL]);
      expect(engine.sources).toHaveLength(1);
    });

    it("starts the waiting programme once, however often it becomes audible", async () => {
      engine.audible = false;
      player.playBattleMusic(TRACK.id, random);
      engine.audible = true;

      engine.audibleListener?.();
      engine.audibleListener?.();
      await settle();

      expect(engine.fetched).toEqual([TRACK_URL]);
    });

    it("starts nothing when the programme was stopped while waiting", async () => {
      engine.audible = false;
      player.playBattleMusic(TRACK.id, random);
      player.stopMusic();
      engine.audible = true;

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
      expect(engine.gains[2]?.targets().at(-1)).toEqual({ level: 0, at: 10 });
    });

    it("leaves the menu theme alone: a combat screen torn down late must not cut it", async () => {
      player.playMenuMusic();
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

      expect(engine.duck?.targets()).toEqual([
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

      expect(engine.duck?.targets().slice(2)).toEqual([
        { level: 0.5, at: 20.5 },
        { level: 1, at: 21.5 },
      ]);
      expect(engine.duck?.calls.filter((call) => call.method === "cancelScheduledValues")).toEqual([
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

      expect(engine.duck?.targets().at(-1)).toEqual({ level: 1, at: 22 });
    });

    it("takes the new level once the previous duck has fully released", async () => {
      await playTrack();
      engine.now = 20;
      player.duckMusic(0.5, 900);
      engine.now = 20.9 + DUCK_RELEASE_SECONDS;

      player.duckMusic(0.7, 500);

      expect(engine.duck?.targets().slice(2)).toEqual([
        { level: 0.7, at: engine.now },
        { level: 1, at: engine.now + 0.5 },
      ]);
    });

    it("does nothing when no music is playing", () => {
      createMixerWithoutMusic();

      player.duckMusic(0.5, 900);

      expect(engine.duck?.calls).toEqual([]);
    });
  });

  describe("setMusicDim", () => {
    it("holds the music down while the pause menu is open, and lets it back up", async () => {
      await playTrack();

      player.setMusicDim(player.MusicDim.Paused, true);
      player.setMusicDim(player.MusicDim.Paused, false);

      expect(engine.dim?.targets()).toEqual([
        { level: PAUSED_LEVEL, at: 0 },
        { level: 1, at: 0 },
      ]);
    });

    it("keeps the lowest level of the reasons that hold", async () => {
      await playTrack();

      player.setMusicDim(player.MusicDim.BattleOver, true);
      player.setMusicDim(player.MusicDim.Paused, true);
      player.setMusicDim(player.MusicDim.BattleOver, false);

      expect(engine.dim?.targets().map((target) => target.level)).toEqual([
        BATTLE_OVER_LEVEL,
        BATTLE_OVER_LEVEL,
        PAUSED_LEVEL,
      ]);
    });

    it("ignores a reason set twice", async () => {
      await playTrack();

      player.setMusicDim(player.MusicDim.Paused, true);
      player.setMusicDim(player.MusicDim.Paused, true);

      expect(engine.dim?.targets()).toHaveLength(1);
    });

    it("lets the bus back up after the fade when the programme stops, so the next is not held down", async () => {
      await playTrack();
      player.setMusicDim(player.MusicDim.BattleOver, true);
      engine.now = 30;

      player.stopMusic();
      player.setMusicDim(player.MusicDim.BattleOver, true);

      expect(engine.dim?.targets().slice(1)).toEqual([
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
      engine.audible = false;

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
