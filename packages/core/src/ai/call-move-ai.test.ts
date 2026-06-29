import { describe, expect, it } from "vitest";
import { isMetronomeCallable } from "../battle/move-copy/callable-moves";
import { ActionKind } from "../enums/action-kind";
import { PlayerId } from "../enums/player-id";
import { buildMoveRegistry, buildMoveTestEngine, MockPokemon } from "../testing";
import { EASY_PROFILE } from "./ai-profiles";
import { pickScoredAction } from "./scored-ai";

describe("call-move AI", () => {
  const pool = [...buildMoveRegistry().values()].filter(isMetronomeCallable);
  const rollOf = (id: string) => (pool.findIndex((move) => move.id === id) + 0.5) / pool.length;

  it("resolves Métronome and points the action at the rolled move's enemy target", () => {
    const user = MockPokemon.fresh(MockPokemon.pidgey, {
      playerId: PlayerId.Player1,
      position: { x: 1, y: 1 },
      moveIds: ["metronome"],
    });
    const foe = MockPokemon.fresh(MockPokemon.bulbasaur, {
      id: "foe-1",
      playerId: PlayerId.Player2,
      position: { x: 2, y: 1 },
    });
    const registry = buildMoveRegistry();
    const { engine, state } = buildMoveTestEngine([user, foe], { random: () => rollOf("tackle") });

    const metronomeActions = engine
      .getLegalActions(PlayerId.Player1)
      .filter((action) => action.kind === ActionKind.UseMove && action.moveId === "metronome");

    const action = pickScoredAction(
      metronomeActions,
      state,
      registry,
      engine,
      { ...EASY_PROFILE, randomWeight: 0, topN: 1 },
      () => rollOf("tackle"),
    );

    expect(action.kind).toBe(ActionKind.UseMove);
    if (action.kind !== ActionKind.UseMove) {
      return;
    }
    expect(state.pokemon.get(user.id)?.pendingCalledMove?.calledMoveId).toBe("tackle");
    expect(action.targetPosition).toEqual({ x: 2, y: 1 });
  });
});
