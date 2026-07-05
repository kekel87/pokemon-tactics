import { describe, expect, it } from "vitest";
import { ActionError } from "../../enums/action-error";
import { ActionKind } from "../../enums/action-kind";
import { BattleEventType } from "../../enums/battle-event-type";
import { PlayerId } from "../../enums/player-id";
import { StatusType } from "../../enums/status-type";
import { buildMoveTestEngine, MockPokemon } from "../../testing";

function makeCaster() {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "attacker",
    playerId: PlayerId.Player1,
    position: { x: 0, y: 0 },
    moveIds: ["outrage", "tackle"],
    currentPp: { outrage: 10 },
    derivedStats: { movement: 3, jump: 1, initiative: 100 },
  });
}

function makeFoe(position: { x: number; y: number }) {
  return MockPokemon.fresh(MockPokemon.base, {
    id: "defender",
    playerId: PlayerId.Player2,
    position,
    derivedStats: { movement: 3, jump: 1, initiative: 10 },
  });
}

describe("outrage", () => {
  it("deals damage to adjacent target", () => {
    const { engine, state } = buildMoveTestEngine([makeCaster(), makeFoe({ x: 1, y: 0 })]);
    const hpBefore = state.pokemon.get("defender")?.currentHp ?? 0;

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "outrage",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.DamageDealt);
    expect(state.pokemon.get("defender")?.currentHp).toBeLessThan(hpBefore);
  });

  it("locks the user into the move without confusing it on the first cast", () => {
    const { engine, state } = buildMoveTestEngine([makeCaster(), makeFoe({ x: 1, y: 0 })]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "outrage",
      targetPosition: { x: 1, y: 0 },
    });

    expect(result.success).toBe(true);
    expect(result.events.map((event) => event.type)).toContain(BattleEventType.LockInStarted);
    expect(state.pokemon.get("attacker")?.lockInMoveId).toBe("outrage");
    expect(state.pokemon.get("attacker")?.lockInTurnsRemaining ?? 0).toBeGreaterThan(0);
    expect(state.pokemon.get("attacker")?.volatileStatuses).not.toContainEqual(
      expect.objectContaining({ type: StatusType.Confused }),
    );
  });

  it("restricts a locked user to the rampage move in its legal actions", () => {
    const { engine, state } = buildMoveTestEngine([makeCaster(), makeFoe({ x: 1, y: 0 })]);
    const live = state.pokemon.get("attacker");
    if (!live) {
      throw new Error("missing attacker");
    }
    live.lockInMoveId = "outrage";
    live.lockInTurnsRemaining = 2;

    const moveIds = engine
      .getLegalActions(PlayerId.Player1)
      .filter((action) => action.kind === ActionKind.UseMove)
      .map((action) => action.moveId);

    expect(moveIds).toContain("outrage");
    expect(moveIds).not.toContain("tackle");
  });

  it("cannot hit out of range", () => {
    const { engine } = buildMoveTestEngine([makeCaster(), makeFoe({ x: 3, y: 0 })]);

    const result = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.UseMove,
      pokemonId: "attacker",
      moveId: "outrage",
      targetPosition: { x: 3, y: 0 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(ActionError.InvalidTarget);
  });
});
