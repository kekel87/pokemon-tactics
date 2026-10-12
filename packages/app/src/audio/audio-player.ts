import { decodeSound } from "./sound-bank";

/**
 * Sound playback (plan 238): one Web Audio context, a master gain — the overall volume — and under
 * it a bus with a volume for each kind of sound (plans 239 and 240): the effects (move sounds, hits,
 * cries), the interface, the battle music and the menus' music.
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

/** The two kinds of music, each with a volume of its own (plan 240). */
export const MusicBus = {
  Battle: "battle",
  Menu: "menu",
} as const;
export type MusicBus = (typeof MusicBus)[keyof typeof MusicBus];

/** The gains the audio plays at, 0..1 each — a muted one is at zero. */
export interface AudioVolumes {
  master: number;
  effects: number;
  interface: number;
  battleMusic: number;
  menuMusic: number;
}

/**
 * Where music plugs in: a bus per kind of music, and behind both the two gains the music player
 * drives — `duck`, lowered for the length of a cry, and `dim`, lowered while the music is held
 * back. `context` is the clock fades are scheduled on.
 */
export interface MusicOutput {
  context: AudioContext;
  buses: Readonly<Record<MusicBus, AudioNode>>;
  duck: GainNode;
  dim: GainNode;
}

interface AudioGraph {
  context: AudioContext;
  master: GainNode;
  effects: GainNode;
  interface: GainNode;
  music: Readonly<Record<MusicBus, GainNode>>;
  musicDuck: GainNode;
  musicDim: GainNode;
}

let graph: AudioGraph | null = null;
let musicAudibleListener: (() => void) | null = null;

/** Create the audio context and resume it on the first user gesture. Safe without Web Audio. */
export function initAudio(volumes: AudioVolumes): void {
  if (graph !== null || typeof AudioContext === "undefined") {
    return;
  }
  const context = new AudioContext();
  const master = context.createGain();
  master.connect(context.destination);
  const bus = (output: AudioNode): GainNode => {
    const node = context.createGain();
    node.connect(output);
    return node;
  };
  // Both kinds of music go through the same duck and dim: one programme plays at a time.
  const musicDim = bus(master);
  const musicDuck = bus(musicDim);
  graph = {
    context,
    master,
    effects: bus(master),
    interface: bus(master),
    music: { [MusicBus.Battle]: bus(musicDuck), [MusicBus.Menu]: bus(musicDuck) },
    musicDuck,
    musicDim,
  };
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
  if (graph === null) {
    return;
  }
  graph.master.gain.value = volumes.master;
  graph.effects.gain.value = volumes.effects;
  graph.interface.gain.value = volumes.interface;
  graph.music[MusicBus.Battle].gain.value = volumes.battleMusic;
  graph.music[MusicBus.Menu].gain.value = volumes.menuMusic;
  notifyMusicAudible();
}

/** What goes through `bus` can be heard: unlocked, not muted, the bus above zero. */
function isAudible(bus: GainNode | undefined): boolean {
  return (
    graph !== null &&
    bus !== undefined &&
    graph.context.state === "running" &&
    graph.master.gain.value !== 0 &&
    bus.gain.value !== 0
  );
}

/** No effect can be heard: muted, effects at zero, or no gesture has unlocked the audio yet. */
export function isAudioSilent(): boolean {
  return !isAudible(graph?.effects);
}

/** This kind of music can be heard: unlocked, not muted, its volume above zero. */
export function isMusicAudible(bus: MusicBus): boolean {
  return isAudible(graph?.music[bus]);
}

function notifyMusicAudible(): void {
  if (isMusicAudible(MusicBus.Battle) || isMusicAudible(MusicBus.Menu)) {
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

/** Where music plugs in, null without Web Audio. */
export function musicOutput(): MusicOutput | null {
  return graph === null
    ? null
    : { context: graph.context, buses: graph.music, duck: graph.musicDuck, dim: graph.musicDim };
}

/** Decode a sound ahead of its cue, so its first play is not late by its decoding. */
export function prepareSound(soundId: string): void {
  void soundReady(soundId);
}

/** Resolves once a sound is decoded, or cannot be: what a loading bar waits on. */
export async function soundReady(soundId: string): Promise<void> {
  if (graph !== null) {
    await decodeSound(graph.context, soundId);
  }
}

/**
 * This kind of music is wanted — not muted, its volume above zero — whether or not the audio is
 * unlocked yet: worth loading behind a loading bar, before the first gesture.
 */
export function isMusicWanted(bus: MusicBus): boolean {
  return graph !== null && graph.master.gain.value !== 0 && graph.music[bus].gain.value !== 0;
}

/**
 * Play a sound from the bundle — dropped when silent or unknown. The handle stops it, also before
 * its decoding has finished.
 */
export function playSound(soundId: string, options: PlayOptions = {}): PlayingSound {
  return playThrough(graph?.effects, soundId, options);
}

/**
 * Play a sound of the interface (plan 240) on its own bus: the cursor, a window, a refusal. Outside
 * the combat clock — a menu does not slow down with a battle.
 */
export function playInterfaceSound(soundId: string, options: PlayOptions = {}): void {
  playThrough(graph?.interface, soundId, options);
}

/** Play a sound through `output`, when what goes through it can be heard. */
function playThrough(
  output: GainNode | undefined,
  soundId: string,
  options: PlayOptions,
): PlayingSound {
  let stopped = false;
  let stopNow: (() => void) | null = null;
  const playing: PlayingSound = {
    stop: () => {
      stopped = true;
      stopNow?.();
    },
  };
  if (graph === null || output === undefined || !isAudible(output)) {
    return playing;
  }
  const audio = graph.context;
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
