import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MusicBus, soundReady } from "./audio-player";
import { AUDIO_LOAD_CAP_MS, battleAudioReady, menuAudioReady } from "./audio-preload";
import { preloadMusic } from "./music-player";
import { soundBundleReady } from "./sound-bank";

vi.mock("../settings", () => ({ getSettings: () => ({ menuMusicId: "rs-center" }) }));
vi.mock("./audio-player", () => ({
  MusicBus: { Battle: "battle", Menu: "menu" },
  soundReady: vi.fn(),
}));
vi.mock("./interface-sounds", () => ({ INTERFACE_SOUNDS: ["ui:move", "ui:open", "ui:error"] }));
vi.mock("./music-player", () => ({ preloadMusic: vi.fn() }));
vi.mock("./sound-bank", () => ({ soundBundleReady: vi.fn() }));

const MENU_THEME = "rs-center";
const BATTLE_TRACK = "bw-trainer";

const NEVER = new Promise<void>(() => undefined);

describe("audio preload", () => {
  let resolved: boolean;

  const watch = (ready: Promise<void>): void => {
    resolved = false;
    void ready.then(() => {
      resolved = true;
    });
  };

  const elapse = async (durationMs: number): Promise<boolean> => {
    await vi.advanceTimersByTimeAsync(durationMs);
    return resolved;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(soundReady).mockReset().mockResolvedValue(undefined);
    vi.mocked(preloadMusic).mockReset().mockResolvedValue(undefined);
    vi.mocked(soundBundleReady).mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("menuAudioReady", () => {
    it("asks for the interface sounds and the menus' theme the player chose, and resolves once they are in", async () => {
      watch(menuAudioReady());

      expect(await elapse(0)).toBe(true);
      expect(vi.mocked(soundReady).mock.calls.map(([soundId]) => soundId)).toEqual([
        "ui:move",
        "ui:open",
        "ui:error",
      ]);
      expect(vi.mocked(preloadMusic).mock.calls).toEqual([[MusicBus.Menu, MENU_THEME]]);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("resolves at once when a load fails", async () => {
      vi.mocked(soundReady).mockRejectedValue(new Error("offline"));
      vi.mocked(preloadMusic).mockRejectedValue(new Error("offline"));
      watch(menuAudioReady());

      expect(await elapse(0)).toBe(true);
    });

    it("gives up at the cap when the theme never comes, and not before", async () => {
      vi.mocked(preloadMusic).mockReturnValue(NEVER);
      watch(menuAudioReady());

      expect(await elapse(AUDIO_LOAD_CAP_MS - 1)).toBe(false);
      expect(await elapse(1)).toBe(true);
    });
  });

  describe("battleAudioReady", () => {
    it("asks for the sound bundle and the battle's music, and resolves once they are in", async () => {
      watch(battleAudioReady(BATTLE_TRACK));

      expect(await elapse(0)).toBe(true);
      expect(soundBundleReady).toHaveBeenCalledTimes(1);
      expect(vi.mocked(preloadMusic).mock.calls).toEqual([[MusicBus.Battle, BATTLE_TRACK]]);
      expect(soundReady).not.toHaveBeenCalled();
    });

    it("asks for the bundle alone for a setup without a music choice", async () => {
      watch(battleAudioReady(undefined));

      expect(await elapse(0)).toBe(true);
      expect(soundBundleReady).toHaveBeenCalledTimes(1);
      expect(preloadMusic).not.toHaveBeenCalled();
    });

    it("resolves at once when a load fails", async () => {
      vi.mocked(soundBundleReady).mockRejectedValue(new Error("offline"));
      vi.mocked(preloadMusic).mockRejectedValue(new Error("offline"));
      watch(battleAudioReady(BATTLE_TRACK));

      expect(await elapse(0)).toBe(true);
    });

    it("gives up at the cap when the bundle never comes, and not before", async () => {
      vi.mocked(soundBundleReady).mockReturnValue(NEVER);
      watch(battleAudioReady(BATTLE_TRACK));

      expect(await elapse(AUDIO_LOAD_CAP_MS - 1)).toBe(false);
      expect(await elapse(1)).toBe(true);
    });
  });
});
