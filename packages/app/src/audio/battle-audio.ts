import type { PresentationCue } from "@pokemon-tactic/render-ports";
import { MoveEffectForm, PresentationCueKind } from "@pokemon-tactic/render-ports";
import { combatClock, isInstantCombat } from "@pokemon-tactic/view-core";
import { getSettings, TurnCries } from "../settings";
import { isAudioSilent, prepareSound } from "./audio-player";
import { createCombatVoices } from "./combat-voices";
import {
  effectSoundEvents,
  moveSoundEvents,
  preloadSoundBundle,
  soundDurationMs,
} from "./sound-bank";

/**
 * The combat's sound (plan 238): a receiver of the presentation cues (plan 233). It plays each
 * move's timed sounds from the attack's start, a hit sound per blow, a cry on a K.O. and, by
 * setting, a cry when a Pokémon's turn begins — every cry heard whole. Local only — cues never
 * cross the network.
 *
 * The combat waits on it (`settled`): an attack's end waits for its sounds, a K.O. fall for its
 * cry, both within a ceiling — the playtest found the battle running over its own sounds.
 * Instant keeps only the hit sounds: the effectiveness is the information worth hearing there.
 */

/** Tuning from the game-designer review and the playtest of plan 238. */
export const TURN_CRY_VOLUME = 0.7;
/** A vocal move with no sound of its own (Rugissement…) borrows its user's cry, a little lower. */
export const BORROWED_CRY_VOLUME = 0.7;
/**
 * The longest an attack's sounds last, from the attack's start: its end waits for them, and a sound
 * running past it fades out there — Surf's wave lasts three seconds, Hypnose's eight.
 */
export const ATTACK_SOUND_MAX_MS = 2000;
export const ATTACK_SOUND_FADE_MS = 250;
/** The longest an AI's turn waits for its Pokémon's cry before acting. */
const TURN_CRY_WAIT_MAX_MS = 2500;
/** The beat the camera gets to reach the Pokémon whose turn begins, before its cry. */
export const TURN_CRY_DELAY_MS = 350;
/** The longest a K.O. fall waits for its cry. */
export const FAINT_CRY_WAIT_MAX_MS = 2500;
/**
 * Blows landing on the same beat (an area attack's targets) are spread out a little: one blow per
 * target, not one loud smear.
 */
export const HIT_STAGGER_MS = 40;
/** At most this many copies of one hit sound at once; past two, each is quieter. */
const MAX_HIT_VOICES = 3;
export const CROWDED_HIT_VOLUME = 0.7;
const HIT_VOICE_WINDOW_MS = 120;
export const HIT_RATE_JITTER = 0.03;

export interface HitSound {
  soundId: string;
  rate: number;
  volume: number;
}

/**
 * The sound of one blow (plan 238): the officials' three — neutral, strong (super effective or
 * critical), weak — with ×4 a little higher and ×¼ lower and quieter. An immune target hears
 * nothing: the silence is the information.
 */
export function hitSound(effectiveness: number, critical: boolean): HitSound | null {
  if (effectiveness === 0) {
    return null;
  }
  if (effectiveness >= 4) {
    return { soundId: "hit:strong", rate: 1.12, volume: 1 };
  }
  if (effectiveness > 1 || critical) {
    return { soundId: "hit:strong", rate: 1, volume: 1 };
  }
  if (effectiveness <= 0.25) {
    return { soundId: "hit:weak", rate: 0.85, volume: 0.7 };
  }
  if (effectiveness < 1) {
    return { soundId: "hit:weak", rate: 1, volume: 1 };
  }
  return { soundId: "hit:normal", rate: 1, volume: 1 };
}

/** The effects that have a sound of their own, played with the effect — our visuals, our timing. */
const EFFECT_SOUND_KEYS: Partial<Record<MoveEffectForm, string>> = {
  [MoveEffectForm.Heal]: "heal",
  [MoveEffectForm.Drain]: "drain",
  [MoveEffectForm.Shield]: "shield",
  [MoveEffectForm.StatUp]: "stat-up",
  [MoveEffectForm.StatDown]: "stat-down",
};

export interface BattleAudioDeps {
  /** The species whose cry a Pokémon pushes. */
  speciesOf(pokemonId: string): string | undefined;
  /** A sound-based move (`flags.sound`): one without a sound of its own borrows the user's cry. */
  isSoundMove(moveId: string): boolean;
  /** False where a turn's cry has no place: the move workshop replays one attack. */
  turnCries: boolean;
}

export interface BattleAudio {
  onCue(cue: PresentationCue): void;
  /** Resolves once the attack's sounds or the K.O. cry in flight have played out (capped). */
  settled(): Promise<void>;
  /** The battle is gone: its sounds stop with it. */
  dispose(): void;
}

export function createBattleAudio(deps: BattleAudioDeps): BattleAudio {
  preloadSoundBundle();
  for (const soundId of ["hit:normal", "hit:strong", "hit:weak"]) {
    prepareSound(soundId);
  }
  // Every sound goes through the voices: they pause, resume and slow down with the combat clock.
  const voices = createCombatVoices();
  const playSound = voices.play;
  /** Combat-clock time until which the combat should let the sounds in flight play. */
  let busyUntil = 0;
  /** The hold being worked out (it needs the bundle's durations). */
  let pendingHold: Promise<void> = Promise.resolve();
  let recentHits: { soundId: string; at: number }[] = [];
  /** An attack is playing: its own sounds already cover the drain it shows. */
  let attackInFlight = false;

  const cryOf = (pokemonId: string): string | null => {
    const species = deps.speciesOf(pokemonId);
    return species === undefined ? null : `cry:${species}`;
  };

  const holdUntil = (at: number): void => {
    busyUntil = Math.max(busyUntil, at);
  };

  /** Play a cry; the combat holds for it (from now, within `waitMaxMs`) when `waitMaxMs` is given. */
  const playCry = (soundId: string, volume: number, waitMaxMs?: number): void => {
    const startedAt = combatClock.now();
    playSound(soundId, { volume });
    if (waitMaxMs !== undefined) {
      pendingHold = soundDurationMs(soundId).then((durationMs) =>
        holdUntil(startedAt + Math.min(durationMs, waitMaxMs)),
      );
    }
  };

  const playMoveSounds = (attackerId: string, moveId: string): void => {
    const startedAt = combatClock.now();
    pendingHold = (async () => {
      const events = await moveSoundEvents(moveId);
      if (events.length === 0) {
        const cry = cryOf(attackerId);
        if (cry !== null && deps.isSoundMove(moveId)) {
          playCry(cry, BORROWED_CRY_VOLUME);
          holdUntil(startedAt + Math.min(await soundDurationMs(cry), ATTACK_SOUND_MAX_MS));
        }
        return;
      }
      let lastEndMs = 0;
      for (const [atMs, soundId, volume, rate] of events) {
        if (atMs >= ATTACK_SOUND_MAX_MS) {
          continue;
        }
        prepareSound(soundId);
        void combatClock.wait(atMs).then(() =>
          playSound(soundId, {
            volume,
            rate,
            maxDurationMs: ATTACK_SOUND_MAX_MS - atMs,
            fadeOutMs: ATTACK_SOUND_FADE_MS,
          }),
        );
        lastEndMs = Math.max(lastEndMs, atMs + (await soundDurationMs(soundId)) / rate);
      }
      holdUntil(startedAt + Math.min(lastEndMs, ATTACK_SOUND_MAX_MS));
    })();
  };

  const playEffectSounds = async (effect: string): Promise<void> => {
    for (const [atMs, soundId, volume, rate] of await effectSoundEvents(effect)) {
      void combatClock.wait(atMs).then(() => playSound(soundId, { volume, rate }));
    }
  };

  const playHit = (effectiveness: number, critical: boolean, rankOnBeat: number): void => {
    const sound = hitSound(effectiveness, critical);
    if (sound === null) {
      return;
    }
    void combatClock.wait(rankOnBeat * HIT_STAGGER_MS).then(() => {
      const now = combatClock.now();
      recentHits = recentHits.filter((hit) => now - hit.at <= HIT_VOICE_WINDOW_MS);
      const voices = recentHits.filter((hit) => hit.soundId === sound.soundId).length;
      if (voices >= MAX_HIT_VOICES) {
        return;
      }
      recentHits.push({ soundId: sound.soundId, at: now });
      const jitter = 1 + (Math.random() * 2 - 1) * HIT_RATE_JITTER;
      playSound(sound.soundId, {
        rate: sound.rate * jitter,
        volume: sound.volume * (voices >= 2 ? CROWDED_HIT_VOLUME : 1),
      });
    });
  };

  const playTurnCry = (pokemonId: string, local: boolean): void => {
    const mode = getSettings().turnCries;
    if (!deps.turnCries || mode === TurnCries.None || (mode === TurnCries.Mine && !local)) {
      return;
    }
    const cry = cryOf(pokemonId);
    if (cry === null) {
      return;
    }
    // The cry comes once the camera has reached the newcomer.
    const cryAt = combatClock.now() + TURN_CRY_DELAY_MS;
    void combatClock.wait(TURN_CRY_DELAY_MS).then(() => playCry(cry, TURN_CRY_VOLUME));
    // The player is never held back by their own Pokémon's cry; an AI's action waits for it.
    if (!local) {
      pendingHold = soundDurationMs(cry).then((durationMs) =>
        holdUntil(cryAt + Math.min(durationMs, TURN_CRY_WAIT_MAX_MS)),
      );
    }
  };

  const onCue = (cue: PresentationCue): void => {
    // Kept even while silent: a mute lifted mid-attack must not find the attack still « in flight ».
    if (cue.kind === PresentationCueKind.AttackStart) {
      attackInFlight = true;
    } else if (cue.kind === PresentationCueKind.AttackEnd) {
      attackInFlight = false;
    }
    if (isAudioSilent()) {
      return;
    }
    if (cue.kind === PresentationCueKind.Hit) {
      playHit(cue.effectiveness, cue.critical, cue.rankOnBeat);
      return;
    }
    if (isInstantCombat()) {
      return;
    }
    switch (cue.kind) {
      case PresentationCueKind.TurnStart:
        playTurnCry(cue.pokemonId, cue.local);
        break;
      case PresentationCueKind.AttackStart:
        playMoveSounds(cue.attackerId, cue.moveId);
        break;
      case PresentationCueKind.Effect: {
        const effect =
          cue.form === MoveEffectForm.Status && cue.status !== undefined
            ? `status:${cue.status}`
            : EFFECT_SOUND_KEYS[cue.form];
        if (effect !== undefined && !(attackInFlight && cue.form === MoveEffectForm.Drain)) {
          void playEffectSounds(effect);
        }
        break;
      }
      case PresentationCueKind.Faint: {
        const cry = cryOf(cue.pokemonId);
        if (cry !== null) {
          playCry(cry, 1, FAINT_CRY_WAIT_MAX_MS);
        }
        break;
      }
      default:
        break;
    }
  };

  const settled = async (): Promise<void> => {
    await pendingHold;
    const remainingMs = busyUntil - combatClock.now();
    if (remainingMs > 0) {
      await combatClock.wait(remainingMs);
    }
  };

  return { onCue, settled, dispose: voices.dispose };
}
