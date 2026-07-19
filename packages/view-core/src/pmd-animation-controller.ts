import type { SemiInvulnerableDisplay } from "@pokemon-tactic/core";
import { animationTotalDurationMs, frameDurationMs as frameDurationMsFor } from "./sprite-atlas.js";
import { computeDisplayDirection, DIRECTION_SECTORS, type PmdDirection } from "./sprite-facing.js";

/**
 * Engine-agnostic PMD sprite animation state machine (plan 126 hoist). Both
 * renderers' `DirectionalBillboard` carried this byte-for-byte: frame indexing,
 * the loop/one-shot/resting state machine, the flying-glide + resting fallbacks,
 * per-frame PMD tick timing, and the pulse / damage-flash / preview-flash /
 * confusion-wobble phase math. None of it touches a mesh — the controller mutates
 * state and computes per-tick SCALARS (pulse scale, tint RGB multiplier, wobble
 * roll, foot lift); the renderer reads those and writes them to its own engine
 * (Babylon `emissiveColor` / Three `color.setRGB`, plane scale, rotation.z, …).
 *
 * Tint is expressed as a plain RGB multiplier in [0,1]³ — white untinted, the KO
 * hex when fainted, a grey dim during the damage blink, a grey sine during the
 * confirm-preview pulse. The renderer applies it to whatever channel it uses
 * (Babylon emissive, Three colour). The dim levels + KO colour are injected via
 * config so the two engines keep their own constants.
 */

/** Animations that loop forever; everything else (Attack/Hop/Hurt/Faint/…) plays once. */
const LOOPING_ANIMATIONS: ReadonlySet<string> = new Set([
  "Idle",
  "Walk",
  "Sleep",
  "FlapAround",
  "Hover",
  "Special0",
  "Special10",
  "FlyingIdle",
]);

/**
 * Flying glide animations tried in priority order; the caller passes the fallback
 * (the 2D renderer uses the step's movement animation — Walk when gliding flat,
 * Hop on a cliff jump). FlyingIdle is synthesised from FlapAround; Hover is a
 * native loop; Special0/Special10 are the per-Pokémon glide poses (e.g. Dracolosse
 * #149 stores its flight as Special0).
 */
export const FLYING_GLIDE_CANDIDATES: readonly string[] = [
  "FlyingIdle",
  "Hover",
  "Special0",
  "Special10",
];

/** Resting animations tried in order when the atlas lacks the requested one (usually Idle). */
const RESTING_FALLBACK_CANDIDATES: readonly string[] = ["Idle", "FlyingIdle", "Hover", "Walk"];

/** A single atlas frame's source sub-rect (pixels in the atlas PNG). */
export interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
}

/** Per-animation PMD `<Durations>` (per-frame tick counts) keyed by animation name. */
export interface AtlasAnimationMeta {
  durations?: number[];
}

/** Minimal atlas JSON shape the controller indexes (frames + per-animation meta). */
export interface AtlasJson {
  frames: Record<string, AtlasFrame>;
  meta: {
    size: { w: number; h: number };
    animations?: Record<string, AtlasAnimationMeta>;
  };
}

/** Indexed frames + durations + grounding for one loaded atlas (engine texture lives in the renderer). */
export interface AtlasIndex {
  framesByKey: Map<string, AtlasFrame[]>;
  durationsByAnimation: Map<string, number[]>;
  atlasWidth: number;
  atlasHeight: number;
  footOffsetY: number;
  headOffsetY: number;
}

/** Timing/scale/tint constants injected by each renderer (mirrored values, kept per-engine). */
export interface PmdAnimationConfig {
  frameDurationMs: number;
  tickDurationMs: number;
  defaultFrameTicks: number;
  pulsePeriodMs: number;
  pulseMinScale: number;
  pulseMaxScale: number;
  flashDurationMs: number;
  /** Number of dim/restore cycles in one damage flash. */
  flashRepeat: number;
  /** Grey level applied on a damage-flash dim half-cycle (0..1). */
  damageFlashDimLevel: number;
  previewFlashPeriodMs: number;
  /** Darkest grey level of the confirm-preview pulse (0..1). */
  previewFlashDimLevel: number;
  confusionWobblePeriodMs: number;
  confusionWobbleAngle: number;
  semiInvulnerableLift: number;
  /** Default px the sprite foot sits above the tile top (until offsets.json loads). */
  spriteGroundOffsetPx: number;
  hudAnchorMarginPx: number;
  /** KO tint as 0xRRGGBB; applied as a dark multiplier when fainted. */
  koTintColor: number;
}

/** An RGB multiplier in [0,1]³ the renderer writes to its tint channel. */
export interface RgbTint {
  r: number;
  g: number;
  b: number;
}

/** What changed in a `tick`, so the renderer re-applies only what it must. */
export interface PmdTickResult {
  /** The displayed frame (animation or direction) changed — re-write the UV + size. */
  frameChanged: boolean;
}

/** Index atlas frames by `"animation-direction"` (ordered by frame index). Pure. */
export function indexFramesByDirection(json: AtlasJson): Map<string, AtlasFrame[]> {
  const framesByKey = new Map<string, AtlasFrame[]>();
  const grouped = new Map<string, { index: number; frame: AtlasFrame }[]>();
  for (const [name, frame] of Object.entries(json.frames)) {
    const lastDash = name.lastIndexOf("-");
    if (lastDash < 0) {
      continue;
    }
    const key = name.slice(0, lastDash);
    const index = Number(name.slice(lastDash + 1));
    const bucket = grouped.get(key) ?? [];
    bucket.push({ index, frame });
    grouped.set(key, bucket);
  }
  for (const [key, entries] of grouped) {
    entries.sort((a, b) => a.index - b.index);
    framesByKey.set(
      key,
      entries.map((entry) => entry.frame),
    );
  }
  return framesByKey;
}

/**
 * Synthesise a looping `FlyingIdle` from `FlapAround` frames 0–1 per direction
 * (wings neutral → up), exactly like the 2D `SpriteLoader`: FlapAround's full
 * 18-frame cycle rotates through all 8 directions and reads wrong as a hover, but
 * its first two frames are a clean directional wing-flap. This is why flyers
 * without a dedicated hover (Roucool) still glide instead of hopping.
 */
export function synthesizeFlyingIdle(framesByKey: Map<string, AtlasFrame[]>): void {
  for (const direction of DIRECTION_SECTORS) {
    const flyingKey = `FlyingIdle-${direction}`;
    if (framesByKey.has(flyingKey)) {
      continue;
    }
    const flap = framesByKey.get(`FlapAround-${direction}`);
    if (!flap || flap.length < 2 || !flap[0] || !flap[1]) {
      continue;
    }
    framesByKey.set(flyingKey, [flap[0], flap[1]]);
  }
}

export class PmdAnimationController {
  private framesByKey = new Map<string, AtlasFrame[]>();
  private durationsByAnimation = new Map<string, number[]>();
  private atlasWidth = 1;
  private atlasHeight = 1;
  private footOffsetY: number;
  private headOffsetY = 0;

  private currentDirection: PmdDirection = "South";
  private currentFrameIndex = 0;
  private animation: string;
  private restingAnimation: string;
  private currentLoops: boolean;
  private oneShotComplete = false;
  private freezeOnComplete = false;
  private onAnimationComplete: (() => void) | null = null;
  private frameElapsedMs = 0;

  private pixelsPerWorldUnit: number;
  private frameWorldWidthValue = 1;
  private frameWorldHeightValue = 1;
  private spriteTopY = 0;

  private pulsing = false;
  private pulseElapsedMs = 0;
  private flashElapsedMs = 0;
  private flashTicksLeft = 0;
  private previewFlashing = false;
  private previewFlashElapsedMs = 0;
  private confusionWobbling = false;
  private confusionWobbleElapsedMs = 0;
  private knockedOut = false;
  private semiInvulnerableState: SemiInvulnerableDisplay = null;

  /** Reused tint, mutated in place each tick (no per-frame allocation). */
  private readonly tintScratch: RgbTint = { r: 1, g: 1, b: 1 };
  private readonly koTint: RgbTint;

  readonly worldFacing: { value: number };

  constructor(
    private readonly config: PmdAnimationConfig,
    initial: { animation: string; worldFacing: number; pixelsPerWorldUnit: number },
  ) {
    this.animation = initial.animation;
    this.restingAnimation = initial.animation;
    this.currentLoops = LOOPING_ANIMATIONS.has(initial.animation);
    this.worldFacing = { value: initial.worldFacing };
    this.pixelsPerWorldUnit = initial.pixelsPerWorldUnit;
    this.footOffsetY = config.spriteGroundOffsetPx;
    this.koTint = {
      r: ((config.koTintColor >> 16) & 0xff) / 255,
      g: ((config.koTintColor >> 8) & 0xff) / 255,
      b: (config.koTintColor & 0xff) / 255,
    };
  }

  get direction(): PmdDirection {
    return this.currentDirection;
  }

  /** Point the controller at a freshly-indexed atlas (real sprite or Clonage doll). */
  bindAtlas(index: AtlasIndex): void {
    this.framesByKey = index.framesByKey;
    this.durationsByAnimation = index.durationsByAnimation;
    this.atlasWidth = index.atlasWidth;
    this.atlasHeight = index.atlasHeight;
    this.footOffsetY = index.footOffsetY;
    this.headOffsetY = index.headOffsetY;
  }

  /**
   * Some atlases carry no Idle at all (Dard/beedrill rests as Hover): fall back
   * through the resting candidates, else the first animation in the atlas. Without
   * this the lookup finds no frames and the sheet renders as a noise rectangle.
   */
  resolveRestingFallback(): void {
    if (this.framesByKey.has(`${this.animation}-${this.currentDirection}`)) {
      return;
    }
    const candidates = [...RESTING_FALLBACK_CANDIDATES];
    const firstKey = this.framesByKey.keys().next().value;
    if (firstKey) {
      candidates.push(firstKey.slice(0, firstKey.lastIndexOf("-")));
    }
    const fallback = candidates.find((candidate) =>
      this.framesByKey.has(`${candidate}-${this.currentDirection}`),
    );
    if (fallback) {
      this.animation = fallback;
      this.restingAnimation = fallback;
    }
  }

  /** True if the atlas carries this animation for the current facing. */
  hasAnimation(animation: string): boolean {
    return this.framesByKey.has(`${animation}-${this.currentDirection}`);
  }

  /** The looping/one-shot animation currently playing (e2e flying-anim assertions). */
  get currentAnimation(): string {
    return this.animation;
  }

  /** The looping animation the sprite reverts to after a one-shot (e2e resting-pose assertions). */
  get currentRestingAnimation(): string {
    return this.restingAnimation;
  }

  /** The frame to display right now (for the renderer to map to UVs), or null. */
  currentFrame(): AtlasFrame | null {
    const frames = this.framesByKey.get(`${this.animation}-${this.currentDirection}`);
    if (!frames || frames.length === 0) {
      return null;
    }
    return frames[this.currentFrameIndex % frames.length] ?? null;
  }

  /** Real display time (ms) of the current frame (PMD tick math). */
  private currentFrameDurationMs(): number {
    return frameDurationMsFor(
      this.durationsByAnimation.get(this.animation),
      this.currentFrameIndex,
      {
        tickMs: this.config.tickDurationMs,
        defaultTicks: this.config.defaultFrameTicks,
        fallbackMs: this.config.frameDurationMs,
      },
    );
  }

  /**
   * Total play time (ms) of an animation for the current facing — sum of its
   * per-frame PMD durations (else frameCount × fallback). 0 if the atlas lacks it.
   * Used to pace the resolution on a KO so the Faint plays out fully (parity).
   */
  animationDurationMs(animation: string): number {
    const frames = this.framesByKey.get(`${animation}-${this.currentDirection}`);
    if (!frames || frames.length === 0) {
      return 0;
    }
    return animationTotalDurationMs(this.durationsByAnimation.get(animation), frames.length, {
      tickMs: this.config.tickDurationMs,
      fallbackMs: this.config.frameDurationMs,
    });
  }

  /**
   * Play a looping animation (Idle/Walk/Sleep/FlyingIdle…). No-op if it is already
   * the current looping animation, so a repeated Walk never resets to frame 0.
   * Returns whether the displayed frame should be re-applied.
   */
  setAnimation(animation: string): boolean {
    if (this.animation === animation && this.currentLoops && !this.oneShotComplete) {
      return false;
    }
    this.startAnimation(animation, { freezeOnComplete: false, onComplete: null });
    return true;
  }

  /** Set the looping animation the sprite reverts to after a one-shot. */
  setRestingAnimation(animation: string): void {
    this.restingAnimation = animation;
  }

  /**
   * Play a one-shot animation (Attack/Shoot/Hop/Hurt/Charge…). On its last frame it
   * reverts to the resting animation, unless `freeze` (Faint/KO) keeps it on the
   * last frame. `onComplete` fires once when the last frame is reached.
   */
  playOnce(animation: string, options: { freeze?: boolean; onComplete?: () => void } = {}): void {
    this.startAnimation(animation, {
      freezeOnComplete: options.freeze ?? false,
      onComplete: options.onComplete ?? null,
    });
  }

  /** Play the first available candidate (looping), else the fallback. Used for the flying glide. */
  playFirstAvailable(candidates: readonly string[], fallback: string): string {
    const chosen = candidates.find((candidate) => this.hasAnimation(candidate)) ?? fallback;
    this.setAnimation(chosen);
    return chosen;
  }

  private startAnimation(
    animation: string,
    options: { freezeOnComplete: boolean; onComplete: (() => void) | null },
  ): void {
    this.animation = animation;
    this.currentLoops = LOOPING_ANIMATIONS.has(animation);
    this.oneShotComplete = false;
    this.freezeOnComplete = options.freezeOnComplete;
    this.onAnimationComplete = options.onComplete;
    this.currentFrameIndex = 0;
    this.frameElapsedMs = 0;
  }

  setWorldFacing(angleRadians: number): void {
    this.worldFacing.value = angleRadians;
  }

  setPixelsPerWorldUnit(value: number): void {
    this.pixelsPerWorldUnit = value;
  }

  /** Active-Pokémon breathing pulse (scale oscillation). */
  setActive(active: boolean): void {
    this.pulsing = active;
    if (!active) {
      this.pulseElapsedMs = 0;
    }
  }

  /**
   * Trigger a brief damage flash (a few dim/restore half-cycles). Returns true if
   * the caller should also play the Hurt recoil pose: a hit
   * not on a KO'd sprite, when the atlas carries Hurt for this facing.
   */
  flashDamage(): boolean {
    this.flashTicksLeft = this.config.flashRepeat * 2;
    this.flashElapsedMs = 0;
    const playHurt = !this.knockedOut && this.hasAnimation("Hurt");
    if (playHurt) {
      this.playOnce("Hurt");
    }
    return playHurt;
  }

  /** Confirm-attack preview flash: a sustained sine pulse marking a locked target. */
  setPreviewFlash(active: boolean): void {
    if (this.previewFlashing === active) {
      return;
    }
    this.previewFlashing = active;
    this.previewFlashElapsedMs = 0;
  }

  /** Confusion wobble: roll the sprite plane back and forth while active. */
  setConfusionWobble(active: boolean): void {
    if (this.confusionWobbling === active) {
      return;
    }
    this.confusionWobbling = active;
    this.confusionWobbleElapsedMs = 0;
  }

  /**
   * KO: the sprite tints dark and (if it has a Faint pose) plays it once then freezes.
   * Returns whether the caller should kick the Faint one-shot — true only on the
   * false→true edge when the atlas carries Faint, so a repeated `setKnockedOut(true)`
   * never restarts it.
   */
  setKnockedOut(knockedOut: boolean): boolean {
    const wasKnockedOut = this.knockedOut;
    this.knockedOut = knockedOut;
    if (knockedOut && !wasKnockedOut) {
      this.setConfusionWobble(false);
      if (this.hasAnimation("Faint")) {
        this.playOnce("Faint", { freeze: true });
        return true;
      }
    }
    return false;
  }

  get isKnockedOut(): boolean {
    return this.knockedOut;
  }

  /**
   * Update the semi-invulnerable display state. Returns the resulting flags the
   * renderer applies (sprite hidden underground; the glide animation is started here
   * via `playFirstAvailable`, and landing reverts to the resting animation).
   */
  setSemiInvulnerable(state: SemiInvulnerableDisplay): { hidden: boolean } {
    const previous = this.semiInvulnerableState;
    this.semiInvulnerableState = state;
    if (state === "flying") {
      this.playFirstAvailable(FLYING_GLIDE_CANDIDATES, "Walk");
    } else if (previous === "flying" && state === null) {
      this.setAnimation(this.restingAnimation);
    }
    return { hidden: state === "underground" };
  }

  /**
   * Advance the animation by `deltaMs` and resolve the displayed PMD direction for
   * the camera azimuth. Pure state mutation — no rendering. The frame-advance loop
   * holds each frame for its own PMD duration (frame-rate independent), and a KO'd
   * sprite only keeps playing its Faint one-shot until it freezes.
   */
  tick(deltaMs: number, cameraAzimuth: number): PmdTickResult {
    let frameChanged = false;

    const nextDirection = computeDisplayDirection(this.worldFacing.value, cameraAzimuth);
    if (nextDirection !== this.currentDirection) {
      this.currentDirection = nextDirection;
      frameChanged = true;
    }

    const faintStillPlaying = this.knockedOut && !this.currentLoops && !this.oneShotComplete;
    if (!this.knockedOut || faintStillPlaying) {
      this.frameElapsedMs += deltaMs;
      let frameDuration = this.currentFrameDurationMs();
      while (this.frameElapsedMs >= frameDuration) {
        this.frameElapsedMs -= frameDuration;
        if (this.advanceFrame()) {
          frameChanged = true;
        }
        frameDuration = this.currentFrameDurationMs();
      }
    }

    this.pulseElapsedMs = this.pulsing
      ? (this.pulseElapsedMs + deltaMs) % this.config.pulsePeriodMs
      : this.pulseElapsedMs;
    this.advanceFlash(deltaMs);
    if (this.previewFlashing && this.flashTicksLeft <= 0 && !this.knockedOut) {
      this.previewFlashElapsedMs =
        (this.previewFlashElapsedMs + deltaMs) % this.config.previewFlashPeriodMs;
    }
    if (this.confusionWobbling) {
      this.confusionWobbleElapsedMs =
        (this.confusionWobbleElapsedMs + deltaMs) % this.config.confusionWobblePeriodMs;
    }

    return { frameChanged };
  }

  private advanceFlash(deltaMs: number): void {
    if (this.flashTicksLeft <= 0) {
      return;
    }
    this.flashElapsedMs += deltaMs;
    if (this.flashElapsedMs < this.config.flashDurationMs) {
      return;
    }
    this.flashElapsedMs -= this.config.flashDurationMs;
    this.flashTicksLeft -= 1;
  }

  /**
   * Advance one frame. Looping animations wrap; one-shots clamp on their last frame,
   * then either freeze (Faint) or revert to the resting animation, firing
   * `onAnimationComplete` once. Returns whether the displayed frame changed.
   */
  private advanceFrame(): boolean {
    if (this.currentLoops) {
      this.currentFrameIndex += 1;
      return true;
    }
    if (this.oneShotComplete) {
      return false;
    }
    const frames = this.framesByKey.get(`${this.animation}-${this.currentDirection}`);
    const lastIndex = (frames?.length ?? 1) - 1;
    if (this.currentFrameIndex < lastIndex) {
      this.currentFrameIndex += 1;
      return true;
    }
    this.oneShotComplete = true;
    const onComplete = this.onAnimationComplete;
    this.onAnimationComplete = null;
    if (!this.freezeOnComplete) {
      this.startAnimation(this.restingAnimation, { freezeOnComplete: false, onComplete: null });
    }
    onComplete?.();
    return true;
  }

  /**
   * Recompute the base frame world size + HUD anchor from the current frame. Call
   * after a frame change or a pixels-per-unit change; the renderer then reads
   * `frameWorldWidth`/`frameWorldHeight` for the plane scale.
   */
  refreshFrameMetrics(): void {
    const frame = this.currentFrame();
    if (!frame) {
      return;
    }
    const { w, h } = frame.frame;
    this.frameWorldHeightValue = h / this.pixelsPerWorldUnit;
    this.frameWorldWidthValue = this.frameWorldHeightValue * (w / h);
    this.spriteTopY = (-this.headOffsetY + this.config.hudAnchorMarginPx) / this.pixelsPerWorldUnit;
  }

  get frameWorldWidth(): number {
    return this.frameWorldWidthValue;
  }

  get frameWorldHeight(): number {
    return this.frameWorldHeightValue;
  }

  /** Y offset (world units) from the root to the top of the current frame, for HUD anchoring. */
  get spriteTopOffsetY(): number {
    return this.spriteTopY;
  }

  /** UV sub-rect of the current frame (V flipped to GL space), or null. */
  frameUv(): { uOffset: number; vOffset: number; uScale: number; vScale: number } | null {
    const frame = this.currentFrame();
    if (!frame) {
      return null;
    }
    const { x, y, w, h } = frame.frame;
    return {
      uOffset: x / this.atlasWidth,
      vOffset: 1 - (y + h) / this.atlasHeight,
      uScale: w / this.atlasWidth,
      vScale: h / this.atlasHeight,
    };
  }

  /** Eased breathing factor in [pulseMinScale, pulseMaxScale]; 1 when not pulsing. */
  pulseScale(): number {
    if (!this.pulsing) {
      return 1;
    }
    const phase =
      (1 - Math.cos((2 * Math.PI * this.pulseElapsedMs) / this.config.pulsePeriodMs)) / 2;
    return (
      this.config.pulseMinScale + (this.config.pulseMaxScale - this.config.pulseMinScale) * phase
    );
  }

  /** World-Y the sprite plane sits at (foot lift + flying semi-invulnerable lift). */
  footLiftY(): number {
    const lift = this.semiInvulnerableState === "flying" ? this.config.semiInvulnerableLift : 0;
    return this.footOffsetY / this.pixelsPerWorldUnit + lift;
  }

  /** Confusion wobble roll (radians) for the sprite plane's local Z; 0 when not wobbling. */
  wobbleRoll(): number {
    if (!this.confusionWobbling) {
      return 0;
    }
    const phase =
      (2 * Math.PI * this.confusionWobbleElapsedMs) / this.config.confusionWobblePeriodMs;
    return Math.sin(phase) * this.config.confusionWobbleAngle;
  }

  /**
   * Current tint as an RGB multiplier (reused object): KO grey when fainted, a grey
   * dim during the damage blink, a grey sine during the confirm-preview pulse, else
   * white. The transient damage flash + KO take priority over the preview pulse.
   */
  tint(): RgbTint {
    if (this.flashTicksLeft > 0) {
      // Dim on odd half-cycles, base on even — reads as a hit blink.
      if (this.flashTicksLeft % 2 === 1) {
        return this.setTint(
          this.config.damageFlashDimLevel,
          this.config.damageFlashDimLevel,
          this.config.damageFlashDimLevel,
        );
      }
      return this.baseTint();
    }
    if (this.previewFlashing && !this.knockedOut) {
      const phase =
        (1 -
          Math.cos((2 * Math.PI * this.previewFlashElapsedMs) / this.config.previewFlashPeriodMs)) /
        2;
      const level = 1 - phase * (1 - this.config.previewFlashDimLevel);
      return this.setTint(level, level, level);
    }
    return this.baseTint();
  }

  private baseTint(): RgbTint {
    if (this.knockedOut) {
      return this.setTint(this.koTint.r, this.koTint.g, this.koTint.b);
    }
    return this.setTint(1, 1, 1);
  }

  private setTint(r: number, g: number, b: number): RgbTint {
    this.tintScratch.r = r;
    this.tintScratch.g = g;
    this.tintScratch.b = b;
    return this.tintScratch;
  }
}
