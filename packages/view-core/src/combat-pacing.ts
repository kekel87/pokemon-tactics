/**
 * Combat presentation pacing (plan 233): the player's combat speed, the combat clock every combat
 * animation runs on, and the hit-stop graded by type effectiveness. Pure presentation — the engine,
 * determinism and the network never see any of it.
 */

export const CombatSpeed = {
  Normal: "normal",
  Instant: "instant",
} as const;
export type CombatSpeed = (typeof CombatSpeed)[keyof typeof CombatSpeed];

export const COMBAT_SPEEDS: readonly CombatSpeed[] = Object.values(CombatSpeed);

/** How much faster every combat animation clock runs (sprite frames, glides, shakes, beats). */
const ANIMATION_TIME_SCALE: Record<CombatSpeed, number> = {
  [CombatSpeed.Normal]: 1,
  [CombatSpeed.Instant]: 4,
};

let currentSpeed: CombatSpeed = CombatSpeed.Normal;

/** Presentation-only: a local preference, never part of the engine nor the network state. */
export function setCombatSpeed(speed: CombatSpeed): void {
  currentSpeed = speed;
}

/** The step after `current` in a settings cycle, back to the first after the last. */
export function nextInCycle<T>(steps: readonly T[], current: T): T {
  return steps[(steps.indexOf(current) + 1) % steps.length] ?? current;
}

/** The speed after `speed` in the settings cycle (Normal ⇄ Instant). */
export function nextCombatSpeed(speed: CombatSpeed): CombatSpeed {
  return nextInCycle(COMBAT_SPEEDS, speed);
}

/** Multiplier applied to the per-frame delta of every combat animation clock. */
function combatTimeScale(): number {
  return ANIMATION_TIME_SCALE[currentSpeed];
}

/** An orchestration wait (beat between events, KO pacing…) at the current combat speed. */
function scaleCombatDelay(durationMs: number): number {
  return durationMs / combatTimeScale();
}

interface ClockTimer {
  at: number;
  resolve: () => void;
  /** The scene that was driving the clock when the wait started — its timers die with it. */
  driver: symbol;
}

/**
 * The combat presentation clock (plan 233): one time base for everything a combat animates —
 * sprite frames, glides, shakes, floating texts, the orchestrator's beats. It runs in **combat
 * time**: real time × the combat speed, frozen while paused, and steppable frame by frame — which is
 * what lets the move workshop scrub an attack. Ambient motion (wind, shimmer, cursor bob) stays on
 * real time by design.
 *
 * The combat scene drives it (`frame` once per frame, also while its tab is hidden). Only the
 * scene attached last drives it: a second live scene (a map preview) cannot speed it up. Without a
 * driving scene (unit tests, a headless run) `wait` falls back to a real timer, so nothing hangs.
 */
class CombatClock {
  private elapsedMs = 0;
  private frameDeltaMs = 0;
  private paused = false;
  private pendingStepMs = 0;
  private drivers: symbol[] = [];
  private timers: ClockTimer[] = [];
  private slowMotion = 1;

  /** Combat time since the clock started. */
  now(): number {
    return this.elapsedMs;
  }

  /** Combat time the current frame advanced by (0 while paused). */
  get deltaMs(): number {
    return this.frameDeltaMs;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  /** Extra slow-down on top of the combat speed (the move workshop's slow speeds), 1 = none. */
  setSlowMotion(factor: number): void {
    this.slowMotion = factor;
  }

  /** The slow motion in force, 1 = none — what a sound slows down by to stay with the picture. */
  get slowMotionFactor(): number {
    return this.slowMotion;
  }

  /**
   * Forget every pending wait without resolving it — the move workshop throws a run away to replay
   * it, and the dead run's timers (its attack's safety net…) must not fire into the new one.
   */
  clearTimers(): void {
    this.timers = [];
  }

  /** While paused: advance by `durationMs` of combat time on the next frame. */
  step(durationMs: number): void {
    this.pendingStepMs += durationMs;
  }

  /** A scene starts driving the clock; the returned token is its key to `frame` and `detach`. */
  attach(): symbol {
    const driver = Symbol("combat-clock-driver");
    this.drivers.push(driver);
    return driver;
  }

  /** The scene is gone: it stops driving, and the waits it started are dropped with it. */
  detach(driver: symbol): void {
    this.drivers = this.drivers.filter((candidate) => candidate !== driver);
    this.timers = this.timers.filter((timer) => timer.driver !== driver);
  }

  /** Called once per frame by the driving scene, before anything animates. */
  frame(driver: symbol, realDeltaMs: number): void {
    if (driver !== this.drivers.at(-1)) {
      return;
    }
    this.frameDeltaMs = this.paused
      ? this.pendingStepMs
      : realDeltaMs * combatTimeScale() * this.slowMotion;
    this.pendingStepMs = 0;
    this.elapsedMs += this.frameDeltaMs;
    const due = this.timers.filter((timer) => timer.at <= this.elapsedMs);
    if (due.length > 0) {
      this.timers = this.timers.filter((timer) => timer.at > this.elapsedMs);
      for (const timer of due) {
        timer.resolve();
      }
    }
  }

  /** Resolve after `durationMs` of combat time. */
  wait(durationMs: number): Promise<void> {
    const driver = this.drivers.at(-1);
    if (driver === undefined) {
      return new Promise((resolve) => setTimeout(resolve, scaleCombatDelay(durationMs)));
    }
    return new Promise((resolve) => {
      this.timers.push({ at: this.elapsedMs + durationMs, resolve, driver });
    });
  }
}

export const combatClock = new CombatClock();

/** True when attack animations are skipped and the result shows straight away. */
export function isInstantCombat(): boolean {
  return currentSpeed === CombatSpeed.Instant;
}

/**
 * Breathing room after a K.O. fall (plan 238, playtest « ça va trop vite ») — in combat time, so
 * Instant shortens it. A pause after every action was tried too and dropped: it broke the flow
 * between turns.
 */
export const KO_PAUSE_MS = 600;

/** One frame at 60 fps — the move workshop's finest scrub step. */
export const IMPACT_FRAME_MS = 1000 / 60;
/** Hit-stop floor for a critical hit — a critical never stacks on top of effectiveness. */
const CRITICAL_PAUSE_MS = 150;
/** Total hit-stop budget for one action, all targets and all hits together. */
export const MAX_ACTION_PAUSE_MS = 250;

/**
 * Hit-stop by effectiveness (game-designer review of plan 233): the first tier whose ceiling the
 * effectiveness stays under. ×0.25 gets none; the ×4 tier is the fallback.
 */
const HIT_STOP_TIERS: readonly { below: number; pauseMs: number }[] = [
  { below: 0.5, pauseMs: 0 },
  { below: 1, pauseMs: 40 },
  { below: 2, pauseMs: 90 },
  { below: 4, pauseMs: 150 },
];
const EXTREME_HIT_STOP_MS = 220;

function pauseForEffectiveness(effectiveness: number): number {
  return HIT_STOP_TIERS.find((tier) => effectiveness < tier.below)?.pauseMs ?? EXTREME_HIT_STOP_MS;
}

/**
 * The hit-stop of one blow: how long attacker and target hold their frame, in nominal combat time
 * (the combat clock scales it). An immune target
 * gets none; a critical takes the longer of its own floor and the effectiveness pause (never the
 * sum); Instant has none.
 *
 * The plan's IMPACT white flash and shake were tried and dropped in the playtest (2026-10-07): a
 * one-frame flash and a 0.06-tile shake were invisible at normal speed. The white flash itself
 * stays, to show who struck in Instant.
 */
export function hitStopMs(effectiveness: number, critical: boolean): number {
  if (effectiveness === 0 || isInstantCombat()) {
    return 0;
  }
  const base = pauseForEffectiveness(effectiveness);
  return critical ? Math.max(base, CRITICAL_PAUSE_MS) : base;
}
