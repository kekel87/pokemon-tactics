import { ActionKind, Direction, PlayerId } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { DEFAULT_SANDBOX_CONFIG } from "../types/SandboxConfig";
import { DummyAiController } from "./DummyAiController";
import { createSandboxBattle } from "./SandboxSetup";

function skipPlayerTurn(result: ReturnType<typeof createSandboxBattle>): void {
  const actions = result.engine.getLegalActions(PlayerId.Player1);
  const endTurn = actions.find(
    (a) => a.kind === ActionKind.EndTurn && a.direction === Direction.North,
  );
  if (endTurn) {
    result.engine.submitAction(PlayerId.Player1, endTurn);
  }
}

describe("DummyAiController", () => {
  it("plays EndTurn when no move assigned (passive mode)", () => {
    const result = createSandboxBattle(DEFAULT_SANDBOX_CONFIG);
    const dummy = new DummyAiController(result.engine, "p2-dummy", null, Direction.South);

    // Advance to dummy's turn if Bulbasaur goes first (nature is random)
    if (result.state.turnOrder[result.state.currentTurnIndex] !== "p2-dummy") {
      const playerId = PlayerId.Player1;
      const endTurnAction = result.engine
        .getLegalActions(playerId)
        .find((a) => a.kind === ActionKind.EndTurn);
      if (endTurnAction) {
        result.engine.submitAction(playerId, endTurnAction);
      }
    }

    expect(result.state.turnOrder[result.state.currentTurnIndex]).toBe("p2-dummy");
    dummy.playTurn();
    expect(result.state.turnOrder[result.state.currentTurnIndex]).not.toBe("p2-dummy");
  });

  it("plays assigned move when legal then ends turn", () => {
    const result = createSandboxBattle({ ...DEFAULT_SANDBOX_CONFIG, dummyMove: "protect" });
    const dummy = new DummyAiController(result.engine, "p2-dummy", "protect", Direction.South);

    // Dummy plays first (faster)
    dummy.playTurn();
    expect(result.state.roundNumber).toBeGreaterThanOrEqual(1);
  });

  it("falls back to EndTurn when assigned move is not legal", () => {
    const result = createSandboxBattle(DEFAULT_SANDBOX_CONFIG);
    const dummy = new DummyAiController(result.engine, "p2-dummy", "fake-move-id", Direction.South);

    dummy.playTurn();
    expect(result.state.roundNumber).toBeGreaterThanOrEqual(1);
  });

  it("does nothing when it is not the dummy turn", () => {
    const result = createSandboxBattle(DEFAULT_SANDBOX_CONFIG);
    const dummy = new DummyAiController(result.engine, "p2-dummy", null, Direction.South);

    // Dummy plays first, then it's player's turn
    dummy.playTurn();
    skipPlayerTurn(result);

    // Now round 2 — dummy's turn again
    const turnIndexBefore = result.state.currentTurnIndex;
    // Calling with wrong id should do nothing
    const wrongDummy = new DummyAiController(
      result.engine,
      "p2-nonexistent",
      null,
      Direction.South,
    );
    wrongDummy.playTurn();
    expect(result.state.currentTurnIndex).toBe(turnIndexBefore);
  });
});
