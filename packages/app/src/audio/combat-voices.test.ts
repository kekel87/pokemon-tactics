import { combatClock } from "@pokemon-tactic/view-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playSound } from "./audio-player";
import { type CombatVoices, createCombatVoices } from "./combat-voices";

const bank = vi.hoisted(() => ({ durations: {} as Record<string, number> }));

vi.mock("./audio-player", () => ({
  playSound: vi.fn(() => ({ stop: vi.fn() })),
}));

vi.mock("./sound-bank", () => ({
  soundDurationMs: async (soundId: string) => bank.durations[soundId] ?? 0,
}));

const SOUND_ID = "move:zap";

describe("createCombatVoices", () => {
  let driver: symbol;
  let voices: CombatVoices;
  let pendingFrame: (() => void) | null;
  let cancelledFrames: number;

  const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

  const advanceClock = (durationMs: number): void => {
    combatClock.frame(driver, durationMs);
  };

  const runFrame = (): void => {
    const frame = pendingFrame;
    pendingFrame = null;
    frame?.();
  };

  const pauseAt = (durationMs: number): void => {
    advanceClock(durationMs);
    combatClock.setPaused(true);
    runFrame();
  };

  const resume = (): void => {
    combatClock.setPaused(false);
    runFrame();
  };

  const playCalls = () => vi.mocked(playSound).mock.calls;

  const stopOf = (callIndex: number) => vi.mocked(playSound).mock.results[callIndex]?.value.stop;

  beforeEach(() => {
    bank.durations = { [SOUND_ID]: 1000 };
    pendingFrame = null;
    cancelledFrames = 0;
    vi.mocked(playSound).mockClear();
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
      pendingFrame = callback;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      cancelledFrames += 1;
      pendingFrame = null;
    });
    driver = combatClock.attach();
    voices = createCombatVoices();
  });

  afterEach(() => {
    voices.dispose();
    combatClock.setPaused(false);
    combatClock.setSlowMotion(1);
    combatClock.detach(driver);
    vi.unstubAllGlobals();
  });

  it("starts a sound at once, from its beginning, with its options", () => {
    voices.play(SOUND_ID, { volume: 0.8, rate: 2 });

    expect(playCalls()).toEqual([[SOUND_ID, { volume: 0.8, rate: 2, offsetMs: 0 }]]);
  });

  it("starts following the clock as soon as a sound plays", () => {
    expect(pendingFrame).toBeNull();

    voices.play(SOUND_ID);

    expect(pendingFrame).not.toBeNull();
  });

  it("leaves a sound alone while the clock just runs", () => {
    voices.play(SOUND_ID);
    advanceClock(100);
    runFrame();

    expect(playSound).toHaveBeenCalledTimes(1);
    expect(stopOf(0)).not.toHaveBeenCalled();
  });

  it("falls silent when the clock pauses", () => {
    voices.play(SOUND_ID);

    pauseAt(100);

    expect(stopOf(0)).toHaveBeenCalledTimes(1);
    expect(playSound).toHaveBeenCalledTimes(1);
  });

  it("picks a sound up where the picture is when the clock resumes", () => {
    voices.play(SOUND_ID, { rate: 2 });
    pauseAt(100);

    resume();

    expect(playCalls()[1]).toEqual([SOUND_ID, { rate: 2, offsetMs: 200 }]);
  });

  it("follows a step made while paused", () => {
    voices.play(SOUND_ID);
    pauseAt(100);
    combatClock.step(50);
    advanceClock(16);
    runFrame();

    resume();

    expect(playCalls()[1]).toEqual([SOUND_ID, { rate: 1, offsetMs: 150 }]);
  });

  it("does not sound a voice asked for while paused until the clock resumes", () => {
    combatClock.setPaused(true);
    voices.play(SOUND_ID);
    runFrame();
    expect(playSound).not.toHaveBeenCalled();

    resume();

    expect(playCalls()).toEqual([[SOUND_ID, { rate: 1, offsetMs: 0 }]]);
  });

  it("keeps only what is left of a capped sound when it picks it up", () => {
    voices.play(SOUND_ID, { maxDurationMs: 600, fadeOutMs: 250 });
    pauseAt(100);

    resume();

    expect(playCalls()[1]).toEqual([
      SOUND_ID,
      { rate: 1, offsetMs: 100, maxDurationMs: 500, fadeOutMs: 250 },
    ]);
  });

  it("slows a sound with the picture under slow motion", () => {
    combatClock.setSlowMotion(0.5);

    voices.play(SOUND_ID, { rate: 2, maxDurationMs: 600 });

    expect(playCalls()).toEqual([[SOUND_ID, { rate: 1, offsetMs: 0, maxDurationMs: 1200 }]]);
  });

  it("picks every voice up at the new pace when the slow motion changes", () => {
    voices.play(SOUND_ID);
    voices.play("move:crackle", { rate: 2 });
    advanceClock(100);

    combatClock.setSlowMotion(0.25);
    runFrame();

    expect(stopOf(0)).toHaveBeenCalledTimes(1);
    expect(stopOf(1)).toHaveBeenCalledTimes(1);
    expect(playCalls().slice(2)).toEqual([
      [SOUND_ID, { rate: 0.25, offsetMs: 100 }],
      ["move:crackle", { rate: 0.5, offsetMs: 200 }],
    ]);
  });

  it("keeps a voice silent when the slow motion changes during a pause", () => {
    voices.play(SOUND_ID);
    pauseAt(100);

    combatClock.setSlowMotion(0.5);
    runFrame();

    expect(playSound).toHaveBeenCalledTimes(1);
  });

  it("forgets a sound once it has played out", async () => {
    voices.play(SOUND_ID);
    await flush();

    pauseAt(1000);
    resume();

    expect(playSound).toHaveBeenCalledTimes(1);
  });

  it("ends a sound sooner at a faster rate", async () => {
    voices.play(SOUND_ID, { rate: 2 });
    await flush();

    pauseAt(500);
    resume();

    expect(playSound).toHaveBeenCalledTimes(1);
  });

  it("ends a capped sound at its cap, not before", async () => {
    voices.play(SOUND_ID, { maxDurationMs: 300 });
    await flush();
    pauseAt(299);
    resume();
    expect(playSound).toHaveBeenCalledTimes(2);

    pauseAt(1);
    resume();

    expect(playSound).toHaveBeenCalledTimes(2);
  });

  it("stops following the clock once every sound has played out", async () => {
    voices.play(SOUND_ID);
    await flush();
    advanceClock(1000);
    runFrame();

    expect(pendingFrame).toBeNull();
  });

  it("follows the clock again for a sound played after the others ended", async () => {
    voices.play(SOUND_ID);
    await flush();
    advanceClock(1000);
    runFrame();

    voices.play(SOUND_ID);
    pauseAt(100);

    expect(stopOf(1)).toHaveBeenCalledTimes(1);
  });

  it("never leaves two instances of a sound played on the frame the clock resumes", () => {
    combatClock.setPaused(true);
    voices.play(SOUND_ID);
    combatClock.setPaused(false);
    voices.play("move:crackle");

    runFrame();

    const crackles = playCalls().flatMap(([soundId], index) =>
      soundId === "move:crackle" ? [index] : [],
    );
    expect(crackles).toEqual([0, 2]);
    expect(stopOf(0)).toHaveBeenCalledTimes(1);
    expect(stopOf(2)).not.toHaveBeenCalled();
  });

  it("silences everything and stops following the clock on dispose", () => {
    voices.play(SOUND_ID);
    voices.play("move:crackle");

    voices.dispose();

    expect(stopOf(0)).toHaveBeenCalledTimes(1);
    expect(stopOf(1)).toHaveBeenCalledTimes(1);
    expect(cancelledFrames).toBe(1);
    expect(pendingFrame).toBeNull();
  });

  it("drops a sound asked for after dispose", () => {
    voices.dispose();

    voices.play(SOUND_ID);

    expect(playSound).not.toHaveBeenCalled();
    expect(pendingFrame).toBeNull();
  });
});
