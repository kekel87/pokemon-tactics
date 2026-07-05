import { describe, expect, it } from "vitest";
import { BattleEventType } from "../enums/battle-event-type";
import { PlayerId } from "../enums/player-id";
import { StatusType } from "../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import { isLockInMove, resolveLockIn } from "./lock-in";

function setup(moveId: string) {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: [moveId, "tackle"],
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: { x: 1, y: 0 },
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  const { engine, state } = buildMoveTestEngine([caster, foe]);
  const live = state.pokemon.get("caster");
  const move = engine.getEffectiveMove("caster", moveId);
  if (!live || !move) {
    throw new Error("setup failed");
  }
  return { state, live, move };
}

describe("lock-in", () => {
  it("flags rampage moves", () => {
    const { move } = setup("outrage");
    expect(isLockInMove(move)).toBe(true);
  });

  it("locks the caster into the move on the first cast without confusing it", () => {
    const { state, live, move } = setup("outrage");
    const events = resolveLockIn(live, move, () => 0, state, []);

    expect(live.lockInMoveId).toBe("outrage");
    expect(live.lockInTurnsRemaining).toBe(1);
    expect(events.map((event) => event.type)).toContain(BattleEventType.LockInStarted);
    expect(events.map((event) => event.type)).not.toContain(BattleEventType.StatusApplied);
  });

  it("rolls the higher bound when the PRNG is high", () => {
    const { state, live, move } = setup("outrage");
    resolveLockIn(live, move, () => 0.99, state, []);
    expect(live.lockInTurnsRemaining).toBe(2);
  });

  it("confuses the caster when the rampage ends (confuseOnEnd)", () => {
    const { state, live, move } = setup("outrage");
    resolveLockIn(live, move, () => 0, state, []);
    const end = resolveLockIn(live, move, () => 0, state, []);

    expect(live.lockInMoveId).toBeUndefined();
    expect(live.lockInTurnsRemaining).toBeUndefined();
    expect(end.map((event) => event.type)).toContain(BattleEventType.StatusApplied);
    expect(live.volatileStatuses).toContainEqual(
      expect.objectContaining({ type: StatusType.Confused }),
    );
  });

  it("does not confuse the caster when Brouhaha ends", () => {
    const { state, live, move } = setup("uproar");
    resolveLockIn(live, move, () => 0, state, []);
    resolveLockIn(live, move, () => 0, state, []);
    const end = resolveLockIn(live, move, () => 0, state, []);

    expect(live.lockInTurnsRemaining).toBeUndefined();
    expect(end.map((event) => event.type)).not.toContain(BattleEventType.StatusApplied);
    expect(live.volatileStatuses).not.toContainEqual(
      expect.objectContaining({ type: StatusType.Confused }),
    );
  });

  it("does not stack a second confusion when the caster is already confused", () => {
    const { state, live, move } = setup("outrage");
    live.volatileStatuses.push({ type: StatusType.Confused, remainingTurns: 3 });
    resolveLockIn(live, move, () => 0, state, []);
    const end = resolveLockIn(live, move, () => 0, state, []);

    expect(end.map((event) => event.type)).not.toContain(BattleEventType.StatusApplied);
    expect(
      live.volatileStatuses.filter((volatile) => volatile.type === StatusType.Confused),
    ).toHaveLength(1);
  });
});
