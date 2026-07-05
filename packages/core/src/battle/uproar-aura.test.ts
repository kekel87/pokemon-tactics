import { describe, expect, it } from "vitest";
import { BattleEventType } from "../enums/battle-event-type";
import { PlayerId } from "../enums/player-id";
import { StatusType } from "../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../testing";
import { isUnderNoSleepAura, isUproarLocked, wakeSleepersInUproarRadius } from "./uproar-aura";

function setup(foePosition: { x: number; y: number }) {
  const caster = MockPokemon.fresh(MockPokemon.base, {
    id: "caster",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["uproar"],
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
  const foe = MockPokemon.fresh(MockPokemon.base, {
    id: "foe",
    playerId: PlayerId.Player2,
    position: foePosition,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
  const { state } = buildMoveTestEngine([caster, foe]);
  const liveCaster = state.pokemon.get("caster");
  const liveFoe = state.pokemon.get("foe");
  if (!liveCaster || !liveFoe) {
    throw new Error("setup failed");
  }
  liveCaster.lockInMoveId = "uproar";
  liveCaster.lockInTurnsRemaining = 3;
  return { state, liveCaster, liveFoe };
}

describe("uproar-aura", () => {
  it("marks a Brouhaha-locked caster as an aura source", () => {
    const { liveCaster } = setup({ x: 1, y: 0 });
    expect(isUproarLocked(liveCaster)).toBe(true);
  });

  it("covers tiles within Manhattan radius 3", () => {
    const { state } = setup({ x: 5, y: 5 });
    expect(isUnderNoSleepAura(state, { x: 3, y: 0 })).toBe(true);
    expect(isUnderNoSleepAura(state, { x: 2, y: 1 })).toBe(true);
  });

  it("does not cover tiles beyond radius 3", () => {
    const { state } = setup({ x: 5, y: 5 });
    expect(isUnderNoSleepAura(state, { x: 4, y: 0 })).toBe(false);
  });

  it("wakes sleepers within radius and leaves distant ones asleep", () => {
    const { state, liveCaster, liveFoe } = setup({ x: 2, y: 0 });
    liveFoe.statusEffects.push({ type: StatusType.Asleep, remainingTurns: 3 });

    const events = wakeSleepersInUproarRadius(state, liveCaster);

    expect(events).toContainEqual(
      expect.objectContaining({ type: BattleEventType.StatusRemoved, targetId: "foe" }),
    );
    expect(liveFoe.statusEffects.some((status) => status.type === StatusType.Asleep)).toBe(false);
  });
});
