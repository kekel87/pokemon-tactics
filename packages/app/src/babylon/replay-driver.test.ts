import { ActionKind, Direction, ForfeitReason, type ReplayForfeit } from "@pokemon-tactic/core";
import type { RemoteActionEnvelope, RemoteActionOutcome } from "@pokemon-tactic/render-ports";
import { describe, expect, it, vi } from "vitest";
import { createReplayDriver } from "./replay-driver";

const actions = [
  { kind: ActionKind.EndTurn, pokemonId: "a", direction: Direction.East },
  { kind: ActionKind.EndTurn, pokemonId: "b", direction: Direction.West },
  { kind: ActionKind.EndTurn, pokemonId: "a", direction: Direction.East },
] as const;

/** Un pilote branché sur un faux orchestrateur : `deliver` avance le compteur d'actions appliquées. */
function setup(options: {
  startPlaying: boolean;
  outcome?: RemoteActionOutcome;
  forfeits?: readonly ReplayForfeit[];
  applied?: number;
}) {
  let applied = options.applied ?? 0;
  let forfeitsApplied = 0;
  const delivered: RemoteActionEnvelope[] = [];
  const deliveredForfeits: ReplayForfeit[] = [];
  const onChange = vi.fn();
  const driver = createReplayDriver({
    actions,
    engine: {
      get actionLogLength() {
        return applied;
      },
      get forfeitLogLength() {
        return forfeitsApplied;
      },
    },
    deliver: (envelope) => {
      delivered.push(envelope);
      const outcome = options.outcome ?? "applied";
      if (outcome !== "rejected") {
        applied += 1;
      }
      return outcome;
    },
    forfeits: options.forfeits ?? [],
    deliverForfeit: (forfeit) => {
      deliveredForfeits.push(forfeit);
    },
    onChange,
    startPlaying: options.startPlaying,
  });
  return {
    driver,
    delivered,
    deliveredForfeits,
    onChange,
    applyForfeit: () => {
      forfeitsApplied += 1;
    },
  };
}

describe("replay driver", () => {
  it("delivers the next action as soon as a turn is ready while playing", () => {
    const { driver, delivered } = setup({ startPlaying: true });

    expect(driver.onTurnReady("player-1")).toBe("pending");

    expect(delivered).toEqual([
      { seat: 0, playerId: "player-1", actionIndex: 0, action: actions[0] },
    ]);
  });

  it("delivers nothing while paused", () => {
    const { driver, delivered } = setup({ startPlaying: false });

    driver.onTurnReady("player-1");

    expect(delivered).toHaveLength(0);
    expect(driver.isPlaying()).toBe(false);
  });

  it("resumes delivery when play is toggled while the orchestrator is waiting", () => {
    const { driver, delivered, onChange } = setup({ startPlaying: false });
    driver.onTurnReady("player-1");

    driver.togglePlay();

    expect(driver.isPlaying()).toBe(true);
    expect(delivered).toHaveLength(1);
    expect(onChange).toHaveBeenCalled();
  });

  it("pauses when play is toggled again", () => {
    const { driver } = setup({ startPlaying: true });

    driver.togglePlay();

    expect(driver.isPlaying()).toBe(false);
  });

  it("plays exactly one action on a step forward while waiting, then stays paused", () => {
    const { driver, delivered } = setup({ startPlaying: false });
    driver.onTurnReady("player-1");

    driver.stepForward();

    expect(delivered).toHaveLength(1);
    expect(driver.isPlaying()).toBe(false);
    driver.onTurnReady("player-2");
    expect(delivered).toHaveLength(1);
  });

  it("defers a step requested during an animation until the next turn is ready", () => {
    const { driver, delivered } = setup({ startPlaying: false });

    driver.stepForward();
    expect(delivered).toHaveLength(0);

    driver.onTurnReady("player-1");
    expect(delivered).toHaveLength(1);

    driver.onTurnReady("player-2");
    expect(delivered).toHaveLength(1);
  });

  it("drops a pending step when paused", () => {
    const { driver, delivered } = setup({ startPlaying: false });
    driver.stepForward();

    driver.pause();
    driver.onTurnReady("player-1");

    expect(delivered).toHaveLength(0);
  });

  it("pause does not notify the bar", () => {
    const { driver, onChange } = setup({ startPlaying: true });

    driver.pause();

    expect(onChange).not.toHaveBeenCalled();
    expect(driver.isPlaying()).toBe(false);
  });

  it("stops playing when the engine rejects an action of its own log", () => {
    const { driver, onChange } = setup({ startPlaying: true, outcome: "rejected" });

    driver.onTurnReady("player-1");

    expect(driver.isPlaying()).toBe(false);
    expect(onChange).toHaveBeenCalled();
  });

  it("stops without delivering when the log is exhausted", () => {
    const { driver, delivered, onChange } = setup({ startPlaying: true });
    for (const player of ["a", "b", "a"]) {
      driver.onTurnReady(player);
    }
    delivered.length = 0;
    onChange.mockClear();

    driver.togglePlay();
    driver.togglePlay();
    driver.onTurnReady("a");

    expect(delivered).toHaveLength(0);
    expect(driver.isPlaying()).toBe(false);
  });

  it("stop() halts playback, drops a pending step and notifies the bar", () => {
    const { driver, delivered, onChange } = setup({ startPlaying: true });
    driver.stepForward();
    onChange.mockClear();

    driver.stop();
    driver.onTurnReady("player-1");

    expect(driver.isPlaying()).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(delivered).toHaveLength(0);
  });
});

describe("replay driver forfeits", () => {
  const dueAtStart: ReplayForfeit = {
    afterAction: 0,
    playerId: "p3",
    reason: ForfeitReason.Resigned,
  };

  it("delivers a due forfeit instead of an action while playing", () => {
    const { driver, delivered, deliveredForfeits } = setup({
      startPlaying: true,
      forfeits: [dueAtStart],
    });

    expect(driver.onTurnReady("player-1")).toBe("pending");

    expect(deliveredForfeits).toEqual([dueAtStart]);
    expect(delivered).toHaveLength(0);
  });

  it("delivers a due forfeit while paused, without consuming the action", () => {
    const { driver, delivered, deliveredForfeits } = setup({
      startPlaying: false,
      forfeits: [dueAtStart],
    });

    driver.onTurnReady("player-1");

    expect(deliveredForfeits).toEqual([dueAtStart]);
    expect(delivered).toHaveLength(0);
  });

  it("keeps a requested step due after the forfeit", () => {
    const { driver, delivered, deliveredForfeits, applyForfeit } = setup({
      startPlaying: false,
      forfeits: [dueAtStart],
    });
    driver.stepForward();

    driver.onTurnReady("player-1");
    expect(delivered).toHaveLength(0);
    applyForfeit();
    driver.onTurnReady("player-2");

    expect(deliveredForfeits).toHaveLength(1);
    expect(delivered).toHaveLength(1);
  });

  it("does not deliver the forfeit again once it is applied", () => {
    const { driver, delivered, deliveredForfeits, applyForfeit } = setup({
      startPlaying: true,
      forfeits: [dueAtStart],
    });
    driver.onTurnReady("player-1");
    applyForfeit();

    driver.onTurnReady("player-2");

    expect(deliveredForfeits).toHaveLength(1);
    expect(delivered).toHaveLength(1);
  });

  it("delivers no forfeit before its rank in the log", () => {
    const { driver, delivered, deliveredForfeits } = setup({
      startPlaying: true,
      forfeits: [{ afterAction: 2, playerId: "p3" }],
    });

    driver.onTurnReady("player-1");

    expect(deliveredForfeits).toHaveLength(0);
    expect(delivered).toHaveLength(1);
  });

  it("delivers a forfeit once the log reaches its rank", () => {
    const forfeit: ReplayForfeit = { afterAction: 2, playerId: "p3" };
    const { driver, delivered, deliveredForfeits } = setup({
      startPlaying: true,
      forfeits: [forfeit],
      applied: 2,
    });

    driver.onTurnReady("player-1");

    expect(deliveredForfeits).toEqual([forfeit]);
    expect(delivered).toHaveLength(0);
  });
});
