import { getSettings } from "../settings";
import { MusicBus, soundReady } from "./audio-player";
import { INTERFACE_SOUNDS } from "./interface-sounds";
import { preloadMusic } from "./music-player";
import { soundBundleReady } from "./sound-bank";

/**
 * What the loading bars wait on for the sound (plan 240, playtest on a phone): heard late, a sound
 * fetched on demand reads as a bug. The splash bar waits for what the menus play at once — the
 * interface sounds and the menus' theme — and a battle's loading veil for its sound bundle and its
 * music.
 *
 * Never longer than `AUDIO_LOAD_CAP_MS`, and never a failure: on a slow network the game opens
 * without its sound rather than stay behind a bar, and the sound comes when it comes.
 */
export const AUDIO_LOAD_CAP_MS = 8000;

function settledWithinCap(loads: readonly Promise<unknown>[]): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, AUDIO_LOAD_CAP_MS);
    void Promise.allSettled(loads).then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** The interface sounds and the menus' theme, ready before the first menu shows. */
export function menuAudioReady(): Promise<void> {
  return settledWithinCap([
    ...INTERFACE_SOUNDS.map(soundReady),
    preloadMusic(MusicBus.Menu, getSettings().menuMusicId),
  ]);
}

/** A battle's sound bundle and its music (none for a setup without a music choice). */
export function battleAudioReady(musicId: string | undefined): Promise<void> {
  return settledWithinCap([
    soundBundleReady(),
    musicId === undefined ? Promise.resolve() : preloadMusic(MusicBus.Battle, musicId),
  ]);
}
