import { combatClock } from "@pokemon-tactic/view-core";
import { type PlayingSound, type PlayOptions, playSound } from "./audio-player";
import { soundDurationMs } from "./sound-bank";

/**
 * The sounds of one combat, kept in step with the combat clock (plan 238). A sound started at a
 * combat instant is heard while the clock runs, falls silent when it pauses and picks up where the
 * picture is when it resumes — the move workshop pauses, steps and scrubs an attack, and its sounds
 * follow the playhead. Under the workshop's slow motion a sound slows with the picture (lower and
 * longer, like a tape), also when the speed changes while it plays.
 *
 * Times are combat time: `maxDurationMs` too.
 */
export interface CombatVoices {
  play(soundId: string, options?: PlayOptions): void;
  /** Silence everything and stop following the clock (the battle is gone). */
  dispose(): void;
}

interface Voice {
  soundId: string;
  options: PlayOptions;
  /** Combat time it started at, and ends at (unknown until the bundle tells its length). */
  startMs: number;
  endMs: number;
  playing: PlayingSound | null;
}

export function createCombatVoices(): CombatVoices {
  const voices = new Set<Voice>();
  let frameRequest = 0;
  let wasPaused = combatClock.isPaused;
  let lastSlowMotion = combatClock.slowMotionFactor;
  let disposed = false;

  /** Start (or pick up) a voice at the clock's current instant. */
  const sound = (voice: Voice): void => {
    const rate = voice.options.rate ?? 1;
    const slowMotion = combatClock.slowMotionFactor;
    const elapsedMs = combatClock.now() - voice.startMs;
    const maxDurationMs = voice.options.maxDurationMs;
    // Never two instances of one voice: `play` may have just started it on the very frame the
    // clock resumed or changed pace.
    voice.playing?.stop();
    voice.playing = playSound(voice.soundId, {
      ...voice.options,
      rate: rate * slowMotion,
      // The sound's own time runs `rate` times the combat's.
      offsetMs: elapsedMs * rate,
      ...(maxDurationMs === undefined
        ? {}
        : { maxDurationMs: (maxDurationMs - elapsedMs) / slowMotion }),
    });
  };

  const follow = (): void => {
    const paused = combatClock.isPaused;
    const now = combatClock.now();
    // A change of speed mid-sound: pick every voice up again at the new pace.
    const repaced = combatClock.slowMotionFactor !== lastSlowMotion;
    for (const voice of voices) {
      if (now >= voice.endMs) {
        voices.delete(voice);
        continue;
      }
      if ((paused && !wasPaused) || repaced) {
        voice.playing?.stop();
        voice.playing = null;
      }
      if (!paused && (wasPaused || repaced)) {
        sound(voice);
      }
    }
    wasPaused = paused;
    lastSlowMotion = combatClock.slowMotionFactor;
    frameRequest = voices.size > 0 ? requestAnimationFrame(follow) : 0;
  };

  return {
    play: (soundId, options = {}) => {
      // A sound scheduled before the battle went away (a wait still pending, the bundle still
      // loading) must not sound over what came next.
      if (disposed) {
        return;
      }
      const startMs = combatClock.now();
      const voice: Voice = {
        soundId,
        options,
        startMs,
        endMs: Number.POSITIVE_INFINITY,
        playing: null,
      };
      voices.add(voice);
      void soundDurationMs(soundId).then((durationMs) => {
        const ownMs = durationMs / (options.rate ?? 1);
        voice.endMs = startMs + Math.min(ownMs, options.maxDurationMs ?? ownMs);
      });
      if (!combatClock.isPaused) {
        sound(voice);
      }
      if (frameRequest === 0) {
        wasPaused = combatClock.isPaused;
        lastSlowMotion = combatClock.slowMotionFactor;
        frameRequest = requestAnimationFrame(follow);
      }
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frameRequest);
      frameRequest = 0;
      for (const voice of voices) {
        voice.playing?.stop();
      }
      voices.clear();
    },
  };
}
