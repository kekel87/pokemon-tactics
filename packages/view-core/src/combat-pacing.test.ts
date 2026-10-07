import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CombatSpeed,
  combatClock,
  hitStopMs,
  isInstantCombat,
  nextCombatSpeed,
  setCombatSpeed,
} from "./combat-pacing.js";

const attachedDrivers: symbol[] = [];

function attachDriver(): symbol {
  const driver = combatClock.attach();
  attachedDrivers.push(driver);
  return driver;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function trackWait(durationMs: number): { resolved: () => boolean } {
  let resolved = false;
  void combatClock.wait(durationMs).then(() => {
    resolved = true;
  });
  return { resolved: () => resolved };
}

afterEach(() => {
  for (const driver of attachedDrivers.splice(0)) {
    combatClock.detach(driver);
  }
  combatClock.setPaused(false);
  combatClock.setSlowMotion(1);
  combatClock.clearTimers();
  setCombatSpeed(CombatSpeed.Normal);
  vi.useRealTimers();
});

describe("hitStopMs", () => {
  it.each([
    [0, 0],
    [0.25, 0],
    [0.5, 40],
    [1, 90],
    [2, 150],
    [4, 220],
  ])("Given effectiveness ×%s without critical, holds %s ms", (effectiveness, expectedMs) => {
    expect(hitStopMs(effectiveness, false)).toBe(expectedMs);
  });

  it.each([
    [0, 0],
    [0.25, 150],
    [0.5, 150],
    [1, 150],
    [2, 150],
    [4, 220],
  ])(
    "Given a critical at ×%s, takes the longer of its floor and the tier (%s ms), never the sum",
    (effectiveness, expectedMs) => {
      expect(hitStopMs(effectiveness, true)).toBe(expectedMs);
    },
  );

  it("Given the Instant speed, holds nothing", () => {
    setCombatSpeed(CombatSpeed.Instant);
    expect(hitStopMs(4, true)).toBe(0);
  });

  it("Given the Fast speed, keeps the nominal hit-stop (the clock halves it)", () => {
    setCombatSpeed(CombatSpeed.Fast);
    expect(hitStopMs(2, false)).toBe(150);
  });
});

describe("isInstantCombat", () => {
  it.each([
    [CombatSpeed.Normal, false],
    [CombatSpeed.Fast, false],
    [CombatSpeed.Instant, true],
  ])("Given the %s speed, answers %s", (speed, expected) => {
    setCombatSpeed(speed);
    expect(isInstantCombat()).toBe(expected);
  });
});

describe("nextCombatSpeed", () => {
  it("cycles Normal → Fast → Instant → Normal", () => {
    expect(nextCombatSpeed(CombatSpeed.Normal)).toBe(CombatSpeed.Fast);
    expect(nextCombatSpeed(CombatSpeed.Fast)).toBe(CombatSpeed.Instant);
    expect(nextCombatSpeed(CombatSpeed.Instant)).toBe(CombatSpeed.Normal);
  });
});

describe("combatClock driven by a scene", () => {
  it("resolves a wait on the frame that reaches its due time, not before", async () => {
    const driver = attachDriver();
    const wait = trackWait(100);

    combatClock.frame(driver, 60);
    await flushMicrotasks();
    expect(wait.resolved()).toBe(false);

    combatClock.frame(driver, 40);
    await flushMicrotasks();
    expect(wait.resolved()).toBe(true);
  });

  it("advances in combat time: Fast doubles the frame delta", async () => {
    const driver = attachDriver();
    setCombatSpeed(CombatSpeed.Fast);
    const wait = trackWait(100);

    combatClock.frame(driver, 50);
    await flushMicrotasks();

    expect(combatClock.deltaMs).toBe(100);
    expect(wait.resolved()).toBe(true);
  });

  it("applies the slow motion on top of the combat speed", async () => {
    const driver = attachDriver();
    combatClock.setSlowMotion(0.25);
    const wait = trackWait(100);

    combatClock.frame(driver, 200);
    await flushMicrotasks();
    expect(combatClock.deltaMs).toBe(50);
    expect(wait.resolved()).toBe(false);

    combatClock.frame(driver, 200);
    await flushMicrotasks();
    expect(wait.resolved()).toBe(true);
  });

  it("freezes while paused and advances only by the requested step", async () => {
    const driver = attachDriver();
    const wait = trackWait(100);
    combatClock.setPaused(true);

    combatClock.frame(driver, 500);
    await flushMicrotasks();
    expect(combatClock.isPaused).toBe(true);
    expect(combatClock.deltaMs).toBe(0);
    expect(wait.resolved()).toBe(false);

    combatClock.step(60);
    combatClock.frame(driver, 500);
    await flushMicrotasks();
    expect(combatClock.deltaMs).toBe(60);
    expect(wait.resolved()).toBe(false);

    combatClock.step(40);
    combatClock.frame(driver, 500);
    await flushMicrotasks();
    expect(wait.resolved()).toBe(true);

    combatClock.frame(driver, 500);
    expect(combatClock.deltaMs).toBe(0);
  });

  it("lets only the scene attached last advance the clock", async () => {
    const firstScene = attachDriver();
    const lastScene = attachDriver();
    const startMs = combatClock.now();
    const wait = trackWait(100);

    combatClock.frame(firstScene, 1000);
    await flushMicrotasks();
    expect(combatClock.now()).toBe(startMs);
    expect(wait.resolved()).toBe(false);

    combatClock.frame(lastScene, 100);
    await flushMicrotasks();
    expect(combatClock.now()).toBe(startMs + 100);
    expect(wait.resolved()).toBe(true);
  });

  it("drops the waits a scene started when it detaches, and hands the clock back", async () => {
    const survivingScene = attachDriver();
    const leavingScene = attachDriver();
    const deadWait = trackWait(100);

    combatClock.detach(leavingScene);
    combatClock.frame(survivingScene, 1000);
    await flushMicrotasks();

    expect(deadWait.resolved()).toBe(false);
    const liveWait = trackWait(100);
    combatClock.frame(survivingScene, 100);
    await flushMicrotasks();
    expect(liveWait.resolved()).toBe(true);
  });

  it("forgets every pending wait on clearTimers without resolving it", async () => {
    const driver = attachDriver();
    const wait = trackWait(100);

    combatClock.clearTimers();
    combatClock.frame(driver, 1000);
    await flushMicrotasks();

    expect(wait.resolved()).toBe(false);
  });
});

describe("combatClock without a driving scene", () => {
  it("falls back to a real timer scaled by the combat speed", async () => {
    vi.useFakeTimers();
    setCombatSpeed(CombatSpeed.Fast);
    const wait = trackWait(100);

    await vi.advanceTimersByTimeAsync(49);
    expect(wait.resolved()).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(wait.resolved()).toBe(true);
  });
});
