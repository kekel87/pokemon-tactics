import { decodeSound } from "./sound-bank";

/**
 * Sound playback (plan 238): one Web Audio context and its master gain — the player's volume.
 *
 * Browsers keep audio suspended until the page gets a user gesture: the context resumes on a click,
 * a touch or a key press, and a sound asked for before that is simply dropped (never queued — a
 * burst of stale sounds on the first click would be worse than silence).
 *
 * Plain Web Audio rather than Babylon's audio engine: one-shot sounds with a rate, a gain and a
 * fade are all this needs, and it keeps the audio free of the 3D engine (the team builder plays
 * cries without any scene).
 */

const UNLOCK_EVENTS = ["pointerdown", "pointerup", "keydown", "touchend", "click"] as const;
const STOP_FADE_SECONDS = 0.03;

export interface PlayOptions {
  /** Gain on top of the master volume, 0..1. */
  volume?: number;
  /** Playback rate: 1 = as recorded; also shifts the pitch. */
  rate?: number;
  /** Cut the sound after this long, fading out over `fadeOutMs`. */
  maxDurationMs?: number;
  /** Start this far into the sound (its own time, before `rate`) — a sound picked up mid-way. */
  offsetMs?: number;
  fadeOutMs?: number;
}

export interface PlayingSound {
  stop(): void;
}

let context: AudioContext | null = null;
let master: GainNode | null = null;

/** Create the audio context and resume it on the first user gesture. Safe without Web Audio. */
export function initAudio(volume: number): void {
  if (context !== null || typeof AudioContext === "undefined") {
    return;
  }
  context = new AudioContext();
  master = context.createGain();
  master.gain.value = volume;
  master.connect(context.destination);
  // Never removed: only some events count as a user activation (a touch's `pointerdown` does not,
  // its `pointerup` does), and a phone suspends the context again when the page goes to the
  // background — every gesture retries while it is not running.
  const audio = context;
  const unlock = (): void => {
    if (audio.state !== "running") {
      void audio.resume();
    }
  };
  for (const type of UNLOCK_EVENTS) {
    window.addEventListener(type, unlock, true);
  }
}

/** The player's volume, 0..1 — applied live, to the sounds already playing too. */
export function setMasterVolume(volume: number): void {
  if (master !== null) {
    master.gain.value = volume;
  }
}

/** Silent: muted, or no gesture has unlocked the audio yet. Nothing worth scheduling. */
export function isAudioSilent(): boolean {
  return master === null || master.gain.value === 0 || context?.state !== "running";
}

/** Decode a sound ahead of its cue, so its first play is not late by its decoding. */
export function prepareSound(soundId: string): void {
  if (context !== null) {
    void decodeSound(context, soundId);
  }
}

/**
 * Play a sound from the bundle — dropped when silent or unknown. The handle stops it, also before
 * its decoding has finished.
 */
export function playSound(soundId: string, options: PlayOptions = {}): PlayingSound {
  let stopped = false;
  let stopNow: (() => void) | null = null;
  const playing: PlayingSound = {
    stop: () => {
      stopped = true;
      stopNow?.();
    },
  };
  if (context === null || master === null || isAudioSilent()) {
    return playing;
  }
  const audio = context;
  const output = master;
  void decodeSound(audio, soundId).then((buffer) => {
    const offsetSeconds = (options.offsetMs ?? 0) / 1000;
    if (buffer === null || stopped || offsetSeconds >= buffer.duration) {
      return;
    }
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = options.rate ?? 1;
    const gain = audio.createGain();
    gain.gain.value = options.volume ?? 1;
    source.connect(gain).connect(output);
    const startAt = audio.currentTime;
    source.start(startAt, offsetSeconds);
    const fadeOut = (fadeSeconds: number, at: number): void => {
      gain.gain.setValueAtTime(gain.gain.value, at);
      gain.gain.linearRampToValueAtTime(0, at + fadeSeconds);
      source.stop(at + fadeSeconds);
    };
    if (options.maxDurationMs !== undefined) {
      const fadeSeconds = (options.fadeOutMs ?? 0) / 1000;
      const cutAt = startAt + options.maxDurationMs / 1000 - fadeSeconds;
      const endsAt = startAt + (buffer.duration - offsetSeconds) / source.playbackRate.value;
      if (cutAt < endsAt) {
        fadeOut(fadeSeconds, cutAt);
      }
    }
    // A short ramp rather than a hard stop: cutting a waveform mid-swing clicks.
    stopNow = () => fadeOut(STOP_FADE_SECONDS, audio.currentTime);
  });
  return playing;
}

let lastMenuCry: PlayingSound | null = null;

/** A Pokémon's cry outside combat (team builder): a new one cuts the previous, never piles up. */
export function playMenuCry(speciesId: string): void {
  lastMenuCry?.stop();
  lastMenuCry = playSound(`cry:${speciesId}`);
}
