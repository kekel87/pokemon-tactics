import {
  MovementPhase,
  type PresentationCue,
  PresentationCueKind,
  SpriteEffect,
} from "@pokemon-tactic/render-ports";
import { combatClock } from "@pokemon-tactic/view-core";
import { ATTACK_SOUND_MAX_MS, HIT_STAGGER_MS, hitSound } from "../audio/battle-audio.js";
import { moveSoundEvents, soundDurationMs } from "../audio/sound-bank.js";
import { t } from "../i18n/index.js";
import type { TranslationKey } from "../i18n/types.js";
import { el } from "../ui/dom/screens/elements.js";

/** Blows landing closer than this are one beat on the timeline (a zone hitting several targets). */
const SAME_BEAT_MS = 20;
/** The ruler is never shorter than this, so a very short attack still reads. */
const MIN_SPAN_MS = 400;
/** Room left after the attack's end, so the last marker isn't glued to the edge. */
const SPAN_MARGIN_MS = 60;
const RULER_STEP_MS = 100;

/** The attacker's attack animation, frame by frame (combat ms), and the frame where the blow lands. */
export interface AttackFrames {
  durationsMs: readonly number[];
  hitFrame: number | null;
}

/** A track entry: a span (clip) or an instant (diamond), in combat ms since the attack started. */
interface TrackItem {
  startMs: number;
  durationMs?: number;
  label: string;
  className?: string;
  /** Who it happens to, when it happens to a Pokémon (sprite effects, movements). */
  pokemonId?: string;
}

/** Blows landing on the same beat, gathered into one diamond. */
interface HitBeat {
  startMs: number;
  labels: string[];
}

/** What one attack run left on the timeline. */
interface Recording {
  endMs: number | null;
  hitStops: TrackItem[];
  hitBeats: HitBeat[];
  faints: TrackItem[];
  whiteFlashes: TrackItem[];
  damageFlashes: TrackItem[];
  movements: TrackItem[];
  effects: TrackItem[];
  attackerSounds: TrackItem[];
  targetSounds: TrackItem[];
}

const TRACKS = [
  "attacker",
  "movement",
  "hitStop",
  "targets",
  "whiteFlash",
  "damageFlash",
  "reaction",
  "faint",
  "effects",
  "attackerSound",
  "targetSound",
] as const;
type TrackId = (typeof TRACKS)[number];

/**
 * The workshop's sequence view (plan 233) — a dope sheet in the spirit of Blender's timeline and
 * Unity Timeline tracks: a ruler in combat ms, one row per track (the attacker's animation frame by
 * frame, the hit-stop, the blows, KOs, the effects and the sounds) and a
 * playhead on the combat clock. Dragging on the tracks scrubs: `onSeek` gets the time aimed at.
 *
 * A run is recorded once per setup (move, attacker, target, speed) and kept: scrubbing replays the
 * attack, and the deterministic replay would only redraw what is already there.
 */
export class MoveWorkshopTimeline {
  readonly element = el("section", "aw-sequence", "atelier-sequence");
  /** Transport controls live in the sequence's header. */
  readonly controls = el("div", "aw-transport");
  private readonly clock = el("span", "aw-clock", "atelier-clock");
  private readonly ruler = el("div", "aw-ruler");
  private readonly area = el("div", "aw-track-area", "atelier-track-area");
  private readonly lanes = new Map<TrackId, HTMLElement>();
  private readonly playhead = el("div", "aw-playhead", "atelier-playhead");
  private readonly abort = new AbortController();
  private origin: number | null = null;
  /** Who attacks in the current run — sprite effects on it are told apart from the targets'. */
  private attackerId: string | null = null;
  private recordingKey: string | null = null;
  private completeKey: string | null = null;
  private recording: Recording = emptyRecording();
  /** When the attacker's hit frame showed in the recorded run (cells are aligned on it). */
  private impactMs: number | null = null;
  private frames: AttackFrames = { durationsMs: [], hitFrame: null };
  /** The target's damage reaction (Hurt pose), frame by frame, in combat ms. */
  private reactionFramesMs: readonly number[] = [];
  private frameRequest = 0;

  constructor(onSeek: (atMs: number) => void) {
    const body = el("div", "aw-tracks");
    const labels = el("div", "aw-track-labels");
    const unit = el("div", "aw-ruler-spacer");
    unit.textContent = "ms";
    labels.append(unit);
    this.area.append(this.ruler);
    for (const track of TRACKS) {
      const label = el("div", `aw-track-label aw-track-${track}`);
      label.textContent = t(`atelier.track.${track}` as TranslationKey);
      const lane = el("div", `aw-lane aw-track-${track}`, `atelier-lane-${track}`);
      labels.append(label);
      this.area.append(lane);
      this.lanes.set(track, lane);
    }
    this.area.append(this.playhead);
    body.append(labels, this.area);
    this.controls.append(this.clock);
    const legend = el("p", "aw-legend", "atelier-legend");
    legend.textContent = t("atelier.legend");
    this.element.append(this.controls, body, legend);

    // Scrub: press and drag anywhere on the tracks or the ruler.
    const seekAt = (event: PointerEvent): void => {
      const box = this.area.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
      onSeek(ratio * this.spanMs());
    };
    const signal = this.abort.signal;
    this.area.addEventListener(
      "pointerdown",
      (event) => {
        this.area.setPointerCapture(event.pointerId);
        seekAt(event);
      },
      { signal },
    );
    this.area.addEventListener(
      "pointermove",
      (event) => {
        if (this.area.hasPointerCapture(event.pointerId)) {
          seekAt(event);
        }
      },
      { signal },
    );

    const follow = (): void => {
      this.placePlayhead();
      this.frameRequest = requestAnimationFrame(follow);
    };
    this.frameRequest = requestAnimationFrame(follow);
    this.render();
  }

  /** The next run's setup; a new setup forgets the recorded one. */
  prepare(key: string, frames: AttackFrames, reactionFramesMs: readonly number[]): void {
    if (key !== this.recordingKey) {
      this.recordingKey = key;
      this.completeKey = null;
      this.recording = emptyRecording();
      this.impactMs = null;
      this.frames = frames;
      this.reactionFramesMs = reactionFramesMs;
      this.render();
    }
    this.origin = null;
  }

  /** Combat ms since the current run's attack started, or null before it starts. */
  position(): number | null {
    return this.origin === null ? null : combatClock.now() - this.origin;
  }

  /**
   * The nearest frame boundary of the attacker's sprite before / after `atMs` (cell starts and the
   * attack's end) — so stepping lands on a frame that actually changes what is on screen.
   */
  frameBoundary(atMs: number, direction: 1 | -1): number {
    const boundaries = [
      0,
      ...this.frameCells().map((cell) => cell.startMs),
      ...this.reactionCells().map((cell) => cell.startMs),
      this.endMs() ?? this.spanMs(),
    ];
    const epsilon = 1;
    const candidates =
      direction > 0
        ? boundaries.filter((boundary) => boundary > atMs + epsilon)
        : boundaries.filter((boundary) => boundary < atMs - epsilon);
    if (candidates.length === 0) {
      return direction > 0 ? Math.max(...boundaries) : 0;
    }
    return direction > 0 ? Math.min(...candidates) : Math.max(...candidates);
  }

  /** The recorded run's visual end, once one attack played out. */
  endMs(): number | null {
    // The last thing on screen, not the action's end: a blink or a pose can outlast it.
    return this.completeKey === this.recordingKey ? this.spanMs() - SPAN_MARGIN_MS : null;
  }

  dispose(): void {
    this.abort.abort();
    cancelAnimationFrame(this.frameRequest);
    this.element.remove();
  }

  /** Feed every presentation cue of the workshop battle. */
  onCue(cue: PresentationCue): void {
    if (cue.kind === PresentationCueKind.AttackStart) {
      this.origin = combatClock.now();
      this.attackerId = cue.attackerId;
      if (this.completeKey !== this.recordingKey) {
        void this.recordMoveSounds(cue.moveId);
      }
      return;
    }
    const at = this.position();
    // A replay of a recorded setup only moves the playhead: the recording already holds it all.
    if (at !== null && this.completeKey !== this.recordingKey) {
      this.record(cue, at);
    }
  }

  /** The move's timed sounds (plan 238), from the sound bundle — known from the start, not heard. */
  private async recordMoveSounds(moveId: string): Promise<void> {
    const key = this.recordingKey;
    const events = (await moveSoundEvents(moveId)).filter(([atMs]) => atMs < ATTACK_SOUND_MAX_MS);
    const sounds = await Promise.all(
      events.map(async ([atMs, soundId, , rate]) => ({
        startMs: atMs,
        // As long as it is heard: an attack's sounds fade out at their ceiling.
        durationMs: Math.min((await soundDurationMs(soundId)) / rate, ATTACK_SOUND_MAX_MS - atMs),
        label: soundId.replace(/^move:(PRSFX- )?/, "").replace(/\.\w+$/, ""),
      })),
    );
    if (key !== this.recordingKey) {
      return;
    }
    this.recording.attackerSounds = sounds;
    this.render();
  }

  private record(
    cue: Exclude<PresentationCue, { kind: typeof PresentationCueKind.AttackStart }>,
    at: number,
  ): void {
    const recording = this.recording;
    switch (cue.kind) {
      case PresentationCueKind.Hit: {
        const label = `${effectivenessLabel(cue.effectiveness)}${cue.critical ? ` · ${t("atelier.critical")}` : ""}`;
        const beat = recording.hitBeats.at(-1);
        if (beat && at - beat.startMs < SAME_BEAT_MS) {
          beat.labels.push(label);
        } else {
          recording.hitBeats.push({ startMs: at, labels: [label] });
        }
        // One hit sound per blow, staggered on its beat as the combat plays it (plan 238).
        const sound = hitSound(cue.effectiveness, cue.critical);
        if (sound !== null) {
          const item: TrackItem = {
            startMs: at + cue.rankOnBeat * HIT_STAGGER_MS,
            durationMs: 0,
            label: effectivenessLabel(cue.effectiveness),
          };
          recording.targetSounds.push(item);
          void soundDurationMs(sound.soundId).then((durationMs) => {
            item.durationMs = durationMs / sound.rate;
            this.render();
          });
        }
        break;
      }
      case PresentationCueKind.HitStop:
        recording.hitStops.push({
          startMs: at,
          durationMs: cue.durationMs,
          label: `${Math.round(cue.durationMs)} ms`,
        });
        break;
      case PresentationCueKind.Faint:
        recording.faints.push({ startMs: at, label: t("atelier.track.faint") });
        break;
      case PresentationCueKind.AttackEnd:
        recording.endMs = at;
        this.completeKey = this.recordingKey;
        break;
      case PresentationCueKind.SpriteEffect: {
        const track =
          cue.effect === SpriteEffect.WhiteFlash ? recording.whiteFlashes : recording.damageFlashes;
        const onAttacker = cue.pokemonId === this.attackerId;
        // Several targets hit together share one bar (same start, same length).
        const same = track.find(
          (item) =>
            Math.abs(item.startMs - at) < SAME_BEAT_MS &&
            item.durationMs === cue.durationMs &&
            (item.pokemonId === this.attackerId) === onAttacker,
        );
        if (!same) {
          track.push({
            startMs: at,
            durationMs: cue.durationMs,
            label: `${Math.round(cue.durationMs)} ms${onAttacker ? ` · ${t("atelier.onAttacker")}` : ""}`,
            className: onAttacker ? "aw-clip aw-on-attacker" : undefined,
            pokemonId: cue.pokemonId,
          });
        }
        break;
      }
      case PresentationCueKind.Movement: {
        const who =
          cue.pokemonId === this.attackerId ? t("atelier.onAttacker") : t("atelier.onTarget");
        if (cue.phase === MovementPhase.Start) {
          recording.movements.push({
            startMs: at,
            durationMs: 0,
            label: who,
            pokemonId: cue.pokemonId,
          });
        } else {
          // Close the movement this Pokémon started (the latest one still open).
          const open = [...recording.movements]
            .reverse()
            .find((item) => item.durationMs === 0 && item.pokemonId === cue.pokemonId);
          if (open) {
            open.durationMs = at - open.startMs;
            open.label = `${who} · ${Math.round(open.durationMs)} ms`;
          }
        }
        break;
      }
      case PresentationCueKind.Effect: {
        const form = t(`atelier.form.${cue.form}` as TranslationKey);
        recording.effects.push({
          startMs: at,
          durationMs: cue.durationMs,
          label:
            cue.impactMs > 0
              ? `${form} · ${t("atelier.impact")} ${Math.round(cue.impactMs)} ms`
              : `${form} · ${Math.round(cue.durationMs)} ms`,
        });
        break;
      }
      case PresentationCueKind.Impact:
        // Shown on the attacker's frame cells: the hit frame is aligned on this measured instant.
        this.impactMs = at;
        break;
    }
    this.render();
  }

  /** Ruler length: through the last recorded item (an effect may outlast the action), plus a margin. */
  private spanMs(): number {
    const recording = this.recording;
    const itemEnds = [
      ...recording.hitStops,
      ...recording.faints,
      ...recording.whiteFlashes,
      ...recording.damageFlashes,
      ...recording.movements,
      ...recording.effects,
      ...recording.attackerSounds,
      ...recording.targetSounds,
      ...this.reactionCells(),
    ].map((item) => item.startMs + (item.durationMs ?? 0));
    const latest = Math.max(
      recording.endMs ?? this.position() ?? 0,
      this.framesTotalMs(),
      ...itemEnds,
    );
    return Math.max(MIN_SPAN_MS, latest + SPAN_MARGIN_MS);
  }

  private framesTotalMs(): number {
    return this.frames.durationsMs.reduce((sum, duration) => sum + duration, 0);
  }

  private placePlayhead(): void {
    // The combat clock runs on after the attack: the playhead stops at the recorded end.
    const at = Math.min(
      Math.max(0, this.position() ?? 0),
      this.endMs() ?? Number.POSITIVE_INFINITY,
    );
    this.playhead.style.left = `${Math.min(100, (at / this.spanMs()) * 100)}%`;
    this.clock.textContent = `${Math.round(at)} ms`;
  }

  /**
   * The attacker's frames as cells. The hit-stop stretches the frame the blow lands on, and that
   * frame starts at the MEASURED impact (the run advances frame by frame, so it lands a little after
   * the atlas' nominal time): the frame before it absorbs the difference.
   */
  private frameCells(): TrackItem[] {
    // Only a hit-stop landing on the swing's impact holds its frame (a dash lands it later).
    const impactMs = this.impactMs;
    const pause =
      impactMs === null
        ? 0
        : (this.recording.hitStops.find((stop) => Math.abs(stop.startMs - impactMs) < SAME_BEAT_MS)
            ?.durationMs ?? 0);
    const { durationsMs, hitFrame } = this.frames;
    const nominalHitStart =
      hitFrame === null ? 0 : durationsMs.slice(0, hitFrame).reduce((sum, ms) => sum + ms, 0);
    const lag =
      hitFrame !== null && hitFrame > 0 && this.impactMs !== null
        ? Math.max(0, this.impactMs - nominalHitStart)
        : 0;
    const cells: TrackItem[] = [];
    let at = 0;
    durationsMs.forEach((duration, index) => {
      const isHit = index === hitFrame;
      const length =
        duration + (isHit ? pause : 0) + (hitFrame !== null && index === hitFrame - 1 ? lag : 0);
      cells.push({
        startMs: at,
        durationMs: length,
        label: String(index + 1),
        className: "aw-frame",
      });
      at += length;
    });
    return cells;
  }

  /**
   * The target's Hurt pose after each blow: it starts with the darkening blink (both are kicked by
   * the damage, on the impact beat), its first frame held by the hit-stop; a later blow cuts it short.
   */
  private reactionCells(): TrackItem[] {
    const starts = this.recording.damageFlashes
      .filter((flash) => flash.pokemonId !== this.attackerId)
      .map((flash) => flash.startMs);
    const cells: TrackItem[] = [];
    starts.forEach((start, startIndex) => {
      const nextBeat = starts[startIndex + 1] ?? Number.POSITIVE_INFINITY;
      // A hit-stop landing on this beat holds the pose's first frame.
      const held =
        this.recording.hitStops.find((stop) => Math.abs(stop.startMs - start) < SAME_BEAT_MS)
          ?.durationMs ?? 0;
      let at = start;
      this.reactionFramesMs.forEach((duration, index) => {
        if (at >= nextBeat) {
          return;
        }
        const length = Math.min(duration + (index === 0 ? held : 0), nextBeat - at);
        cells.push({
          startMs: at,
          durationMs: length,
          label: String(index + 1),
          className: "aw-frame",
        });
        at += length;
      });
    });
    return cells;
  }

  /** A thin line where the blow lands, over the frame cells (which stay readable). */
  private impactMarker(): TrackItem[] {
    const { hitFrame } = this.frames;
    if (hitFrame === null) {
      return [];
    }
    const hitCell = this.frameCells()[hitFrame];
    return hitCell
      ? [{ startMs: hitCell.startMs, label: t("atelier.impact"), className: "aw-marker" }]
      : [];
  }

  private render(): void {
    const span = this.spanMs();
    const percent = (ms: number): string => `${(ms / span) * 100}%`;

    const ticks: HTMLElement[] = [];
    for (let ms = 0; ms <= span; ms += RULER_STEP_MS) {
      const tick = el("span", "aw-tick");
      // Positions come from the measured span at runtime — no static CSS can express them.
      tick.style.left = percent(ms);
      tick.textContent = String(ms);
      ticks.push(tick);
    }
    this.ruler.replaceChildren(...ticks);

    const recording = this.recording;
    const itemsByTrack: Record<TrackId, TrackItem[]> = {
      attacker: [...this.frameCells(), ...this.impactMarker()],
      whiteFlash: recording.whiteFlashes,
      damageFlash: recording.damageFlashes,
      hitStop: recording.hitStops,
      targets: recording.hitBeats.map((beat, index, beats) => ({
        startMs: beat.startMs,
        // Several beats = a multi-hit move: number the blows.
        label: `${beats.length > 1 ? `${t("atelier.blow", { number: index + 1 })} · ` : ""}${beatLabel(beat.labels)}`,
      })),
      reaction: this.reactionCells(),
      movement: recording.movements,
      faint: recording.faints,
      effects: recording.effects,
      attackerSound: recording.attackerSounds,
      targetSound: recording.targetSounds,
    };
    for (const track of TRACKS) {
      this.lanes.get(track)?.replaceChildren(
        ...itemsByTrack[track].map((item) => {
          const node = el(
            "span",
            item.className ?? (item.durationMs === undefined ? "aw-key" : "aw-clip"),
          );
          node.style.left = percent(item.startMs);
          if (item.durationMs !== undefined) {
            node.style.width = percent(item.durationMs);
          }
          node.title = `+${Math.round(item.startMs)} ms${
            item.durationMs === undefined ? "" : ` · ${Math.round(item.durationMs)} ms`
          }`;
          node.dataset.label = item.label;
          return node;
        }),
      );
    }
    this.placePlayhead();
  }
}

function emptyRecording(): Recording {
  return {
    endMs: null,
    hitStops: [],
    hitBeats: [],
    faints: [],
    whiteFlashes: [],
    damageFlashes: [],
    movements: [],
    effects: [],
    attackerSounds: [],
    targetSounds: [],
  };
}

/** « super efficace » for one target, « 3 cibles · normal » when all took the same, else each listed. */
function beatLabel(labels: readonly string[]): string {
  const [first] = labels;
  if (labels.length === 1 || first === undefined) {
    return first ?? "";
  }
  return labels.every((label) => label === first)
    ? `${t("atelier.targetsCount", { count: labels.length })} · ${first}`
    : labels.join(" / ");
}

/** The effectiveness in words (the bare multiplier read as a hit count). */
function effectivenessLabel(effectiveness: number): string {
  if (effectiveness === 0) {
    return t("atelier.effectiveness.immune");
  }
  if (effectiveness < 1) {
    return t("atelier.effectiveness.weak");
  }
  if (effectiveness === 1) {
    return t("atelier.effectiveness.normal");
  }
  return t(effectiveness < 4 ? "atelier.effectiveness.strong" : "atelier.effectiveness.extreme");
}
