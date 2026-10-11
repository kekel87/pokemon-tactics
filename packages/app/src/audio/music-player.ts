import { isMusicAudible, type MusicOutput, musicOutput, onMusicAudible } from "./audio-player";
import { MENU_MUSIC_TRACK, type MusicTrack } from "./music-track-table";
import { createMedleyOrder, findBattleTrack, isMedleyMusicId } from "./music-tracks";

/**
 * The music (plan 239): one programme at a time — the menus' theme, a battle track looped for the
 * whole battle, or a medley of battle tracks.
 *
 * A track is fetched and decoded when it is about to play, and looped by the audio engine itself
 * between its loop points: sample-accurate, where a timer seeking an `<audio>` element is heard.
 * Decoded, a track weighs tens of MB: only the one playing is kept, two around a crossfade.
 *
 * The music lives outside the combat clock: it neither pauses, slows nor speeds up with a battle.
 * Nothing is fetched while it cannot be heard (audio still locked, muted, volume at zero) — a
 * programme waits and starts the moment it can be, a medley holds its next track back.
 */

const MUSIC_PATH = "assets/audio/music";
const FADE_IN_SECONDS = 1;
const STOP_FADE_SECONDS = 0.5;
const DIM_RESET_SECONDS = 0.1;
/** A medley track gives way at its first loop end past this long. */
const MEDLEY_MIN_TRACK_SECONDS = 150;
const MEDLEY_CROSSFADE_SECONDS = 1.5;
/** How long before its entry the next medley track is fetched and decoded. */
const MEDLEY_PREPARE_SECONDS = 6;
/** How long a medley waits after a track that would not load before trying another. */
const MEDLEY_RETRY_SECONDS = 30;
const MEDLEY_POLL_MS = 1000;
/** A fade is an exponential approach: this many time constants in, it is within 2 % of its end. */
const FADE_TIME_CONSTANTS = 4;
const DUCK_ATTACK_SECONDS = 0.08;
const DUCK_RELEASE_SECONDS = 0.3;

/** Why the music is held down for a while — each reason has its own level, the lowest wins. */
export const MusicDim = {
  /** The pause menu is open. */
  Paused: "paused",
  /** The battle is over: the result screen is up. */
  BattleOver: "battle-over",
} as const;
export type MusicDim = (typeof MusicDim)[keyof typeof MusicDim];

const DIM_LEVELS: Readonly<Record<MusicDim, { level: number; fadeSeconds: number }>> = {
  [MusicDim.Paused]: { level: 0.4, fadeSeconds: 0.3 },
  [MusicDim.BattleOver]: { level: 0.3, fadeSeconds: 2 },
};

interface Mixer extends MusicOutput {
  /** Lowered for the length of a cry. */
  duck: GainNode;
  /** Lowered while a `MusicDim` reason holds. */
  dim: GainNode;
}

/** One track playing. */
interface Voice {
  fadeOut(seconds: number): void;
}

interface Programme {
  /** `failed` is called when the programme could not play at all: nothing is left of it. */
  start(mixer: Mixer, failed: () => void): void;
  stop(): void;
}

let mixer: Mixer | null = null;
let current: Programme | null = null;
let currentIsMenu = false;
/** The current programme has not started yet: the music could not be heard when it was asked. */
let waiting = false;
const activeDims = new Set<MusicDim>();
let duckUntil = 0;
let duckLevel = 1;

function getMixer(): Mixer | null {
  if (mixer !== null) {
    return mixer;
  }
  const output = musicOutput();
  if (output === null) {
    return null;
  }
  const duck = output.context.createGain();
  const dim = output.context.createGain();
  duck.connect(dim).connect(output.node);
  mixer = { ...output, duck, dim };
  onMusicAudible(startWaitingProgramme);
  return mixer;
}

/** Fetch and decode a track; null when it fails or `signal` aborts — a silent track, never an error. */
async function loadTrack(
  context: AudioContext,
  track: MusicTrack,
  signal: AbortSignal,
): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(`${MUSIC_PATH}/${track.id}.mp3`, { signal });
    if (!response.ok) {
      return null;
    }
    const encoded = await response.arrayBuffer();
    return signal.aborted ? null : await context.decodeAudioData(encoded);
  } catch {
    return null;
  }
}

/**
 * Bring a gain to `level` over about `seconds`, from wherever it is at `at` — also in the middle of
 * another fade. An exponential approach, on purpose: it starts from the value the engine computes,
 * where a linear ramp needs that value read from `AudioParam.value`, which does not report a fade
 * in flight in every browser (the music would jump to full volume before coming down).
 */
function approach(gain: AudioParam, level: number, at: number, seconds: number): void {
  gain.setTargetAtTime(level, at, seconds / FADE_TIME_CONSTANTS);
}

/** Start a decoded track on its loop, fading in. */
function startVoice(target: Mixer, track: MusicTrack, buffer: AudioBuffer): Voice {
  const { context } = target;
  const at = context.currentTime;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.loopStart = track.loopStartMs / 1000;
  source.loopEnd = track.loopEndMs / 1000;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, at);
  approach(gain.gain, 1, at, FADE_IN_SECONDS);
  source.connect(gain).connect(target.duck);
  source.start(at);
  return {
    fadeOut: (seconds) => {
      const now = context.currentTime;
      approach(gain.gain, 0, now, seconds);
      source.stop(now + seconds);
      // Let go of the decoded track once it has gone silent.
      source.addEventListener("ended", () => gain.disconnect(), { once: true });
    },
  };
}

/** One track, looped until stopped. */
function loopProgramme(track: MusicTrack): Programme {
  const loading = new AbortController();
  let voice: Voice | null = null;
  return {
    start: (target, failed) => {
      void loadTrack(target.context, track, loading.signal).then((buffer) => {
        // Stopped while the track was decoding: it must not start over what came next.
        if (loading.signal.aborted) {
          return;
        }
        if (buffer === null) {
          failed();
          return;
        }
        voice = startVoice(target, track, buffer);
      });
    },
    stop: () => {
      loading.abort();
      voice?.fadeOut(STOP_FADE_SECONDS);
    },
  };
}

/** How long a medley track plays before giving way: up to its first loop end past the minimum. */
function medleyLengthOf(track: MusicTrack): number {
  const loopEnd = track.loopEndMs / 1000;
  const loopLength = (track.loopEndMs - track.loopStartMs) / 1000;
  const loops =
    loopLength > 0 ? Math.max(0, Math.ceil((MEDLEY_MIN_TRACK_SECONDS - loopEnd) / loopLength)) : 0;
  return loopEnd + loops * loopLength;
}

/** Battle tracks in a drawn order, each crossfading into the next. */
function medleyProgramme(random: () => number): Programme {
  const nextTrack = createMedleyOrder(random);
  const loading = new AbortController();
  let voice: Voice | null = null;
  /** Audio-engine time the playing track gives way at — at once, for the first. */
  let endsAt = 0;
  /** The next track is on its way in: the one playing loops on until then. */
  let preparing = false;
  let poll = 0;

  // Polled on the audio engine's own time rather than timed: that clock stops with a hidden tab.
  const follow = (target: Mixer): void => {
    const { context } = target;
    if (preparing || !isMusicAudible() || context.currentTime < endsAt - MEDLEY_PREPARE_SECONDS) {
      return;
    }
    const track = nextTrack();
    if (track === undefined) {
      return;
    }
    preparing = true;
    void loadTrack(context, track, loading.signal).then((buffer) => {
      if (loading.signal.aborted) {
        return;
      }
      if (buffer === null) {
        // Offline, or a file gone: the track playing loops on, another is tried later.
        endsAt = context.currentTime + MEDLEY_RETRY_SECONDS + MEDLEY_PREPARE_SECONDS;
        preparing = false;
        return;
      }
      // Decoded a few seconds early: it comes in as the other reaches its loop end.
      const enterInSeconds = Math.max(0, endsAt - MEDLEY_CROSSFADE_SECONDS - context.currentTime);
      window.setTimeout(() => {
        if (loading.signal.aborted) {
          return;
        }
        voice?.fadeOut(MEDLEY_CROSSFADE_SECONDS);
        voice = startVoice(target, track, buffer);
        endsAt = context.currentTime + medleyLengthOf(track);
        preparing = false;
      }, enterInSeconds * 1000);
    });
  };

  return {
    start: (target) => {
      // A medley never fails as a whole: a track that will not load is skipped.
      follow(target);
      poll = window.setInterval(() => follow(target), MEDLEY_POLL_MS);
    },
    stop: () => {
      loading.abort();
      window.clearInterval(poll);
      voice?.fadeOut(STOP_FADE_SECONDS);
    },
  };
}

function startWaitingProgramme(): void {
  const target = getMixer();
  const programme = current;
  if (waiting && programme !== null && target !== null) {
    waiting = false;
    // A programme that could not load is forgotten, so that asking again tries again — the menus'
    // theme at the next screen, rather than silent menus until the next battle.
    programme.start(target, () => {
      if (current === programme) {
        current = null;
      }
    });
  }
}

function play(programme: Programme, isMenu: boolean): void {
  stopMusic();
  current = programme;
  currentIsMenu = isMenu;
  waiting = true;
  // Also what subscribes to the music becoming audible, when there is an audio engine at all.
  if (getMixer() !== null && isMusicAudible()) {
    startWaitingProgramme();
  }
}

/** The menus' theme. Already playing: left alone, so it runs on from a menu screen to the next. */
export function playMenuMusic(): void {
  if (current === null || !currentIsMenu) {
    play(loopProgramme(MENU_MUSIC_TRACK), true);
  }
}

/**
 * A battle's music: a track id, or the medley — whose order is drawn from `random`, so that peers
 * given the same seed hear the same tracks. An unknown id plays nothing: music never blocks a
 * battle. Always starts anew, also when the same choice was playing (« Rejouer »).
 */
export function playBattleMusic(musicId: string, random: () => number): void {
  const track = findBattleTrack(musicId);
  if (isMedleyMusicId(musicId)) {
    play(medleyProgramme(random), false);
  } else if (track === undefined) {
    stopMusic();
  } else {
    play(loopProgramme(track), false);
  }
}

/** Fade the music out and forget the programme. */
export function stopMusic(): void {
  current?.stop();
  current = null;
  waiting = false;
  // What held the music down ends with the programme. The bus comes back up once the track has
  // faded out, and quickly: the next programme must not start held down.
  if (activeDims.size > 0 && mixer !== null) {
    const at = mixer.context.currentTime + STOP_FADE_SECONDS;
    mixer.dim.gain.cancelScheduledValues(at);
    approach(mixer.dim.gain, 1, at, DIM_RESET_SECONDS);
  }
  activeDims.clear();
}

/**
 * Stop a battle's music, and only that: a combat screen torn down late — after the menu it left
 * for has mounted — must not cut the menus' theme.
 */
export function stopBattleMusic(): void {
  if (!currentIsMenu) {
    stopMusic();
  }
}

/** Hold the music down for a reason (the pause menu, the result screen), or let it back up. */
export function setMusicDim(reason: MusicDim, active: boolean): void {
  if (active === activeDims.has(reason)) {
    return;
  }
  if (active) {
    activeDims.add(reason);
  } else {
    activeDims.delete(reason);
  }
  const target = getMixer();
  if (target === null) {
    return;
  }
  const level = Math.min(1, ...[...activeDims].map((dim) => DIM_LEVELS[dim].level));
  approach(target.dim.gain, level, target.context.currentTime, DIM_LEVELS[reason].fadeSeconds);
}

/**
 * Lower the music to `level` for `durationMs` — the length of a cry — then let it back up. A duck
 * asked for during another extends it at the lower of the two levels, without coming up in
 * between: cries in a row must not make the music pump.
 */
export function duckMusic(level: number, durationMs: number): void {
  const target = getMixer();
  if (target === null || current === null) {
    return;
  }
  const now = target.context.currentTime;
  const ducking = now < duckUntil + DUCK_RELEASE_SECONDS;
  duckLevel = ducking ? Math.min(duckLevel, level) : level;
  duckUntil = Math.max(duckUntil, now + durationMs / 1000);
  const gain = target.duck.gain;
  // Drops the release of a duck still in flight; what is already under way carries on from there.
  gain.cancelScheduledValues(now);
  approach(gain, duckLevel, now, DUCK_ATTACK_SECONDS);
  approach(gain, 1, Math.max(duckUntil, now + DUCK_ATTACK_SECONDS), DUCK_RELEASE_SECONDS);
}
