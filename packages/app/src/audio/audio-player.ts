import { decodeSound } from "./sound-bank";

/**
 * Sound playback (plan 238): one Web Audio context, a master gain — the overall volume — and under
 * it two buses with a volume each (plan 239): the effects (move sounds, hits, cries) and the music.
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

/** The gains the audio plays at, 0..1 each — a muted one is at zero. */
export interface AudioVolumes {
  master: number;
  effects: number;
  music: number;
}

/** The music bus: where a track plugs in, and the clock its fades are scheduled on. */
export interface MusicOutput {
  context: AudioContext;
  node: AudioNode;
}

let context: AudioContext | null = null;
let master: GainNode | null = null;
let effects: GainNode | null = null;
let music: GainNode | null = null;
let musicAudibleListener: (() => void) | null = null;

/** Create the audio context and resume it on the first user gesture. Safe without Web Audio. */
export function initAudio(volumes: AudioVolumes): void {
  if (context !== null || typeof AudioContext === "undefined") {
    return;
  }
  context = new AudioContext();
  master = context.createGain();
  master.connect(context.destination);
  effects = context.createGain();
  effects.connect(master);
  music = context.createGain();
  music.connect(master);
  setAudioVolumes(volumes);
  // Never removed: only some events count as a user activation (a touch's `pointerdown` does not,
  // its `pointerup` does), and a phone suspends the context again when the page goes to the
  // background — every gesture retries while it is not running.
  const audio = context;
  const unlock = (): void => {
    if (audio.state !== "running") {
      void audio.resume();
    }
  };
  audio.addEventListener("statechange", notifyMusicAudible);
  // A hidden tab would keep its music going: all the audio stops with the page and picks up where
  // it was. Resuming needs no gesture once the page has had one.
  document.addEventListener("visibilitychange", () => {
    void (document.hidden ? audio.suspend() : audio.resume());
  });
  for (const type of UNLOCK_EVENTS) {
    window.addEventListener(type, unlock, true);
  }
}

/** The player's volumes — applied live, to what is already playing too. */
export function setAudioVolumes(volumes: AudioVolumes): void {
  if (master === null || effects === null || music === null) {
    return;
  }
  master.gain.value = volumes.master;
  effects.gain.value = volumes.effects;
  music.gain.value = volumes.music;
  notifyMusicAudible();
}

/** No effect can be heard: muted, effects at zero, or no gesture has unlocked the audio yet. */
export function isAudioSilent(): boolean {
  return (
    master === null ||
    master.gain.value === 0 ||
    effects?.gain.value === 0 ||
    context?.state !== "running"
  );
}

/** Music can be heard: unlocked, not muted, its volume above zero. */
export function isMusicAudible(): boolean {
  return context?.state === "running" && master?.gain.value !== 0 && music?.gain.value !== 0;
}

function notifyMusicAudible(): void {
  if (isMusicAudible()) {
    musicAudibleListener?.();
  }
}

/**
 * `listener` is called each time the music may have become audible (the first gesture, a mute
 * lifted, the volume raised from zero): a track that was not worth fetching gets its start. One
 * listener — the music player.
 */
export function onMusicAudible(listener: () => void): void {
  musicAudibleListener = listener;
}

/** The music bus, null without Web Audio. */
export function musicOutput(): MusicOutput | null {
  return context === null || music === null ? null : { context, node: music };
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
  if (context === null || effects === null || isAudioSilent()) {
    return playing;
  }
  const audio = context;
  const output = effects;
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
