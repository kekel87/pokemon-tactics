import { ActionKind, Direction, PlayerId } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { DummyAiController } from "./DummyAiController";
import { createSandboxBattle } from "./SandboxSetup";
import { DEFAULT_SANDBOX_CONFIG } from "./sandbox-config.js";

function skipPlayerTurn(result: ReturnType<typeof createSandboxBattle>): void {
  const actions = result.engine.getLegalActions(PlayerId.Player1);
  const endTurn = actions.find(
    (a) => a.kind === ActionKind.EndTurn && a.direction === Direction.North,
  );
  if (endTurn) {
    result.engine.submitAction(PlayerId.Player1, endTurn);
  }
}

function skipToDummyTurn(result: ReturnType<typeof createSandboxBattle>): void {
  for (let i = 0; i < 20 && result.state.activePokemonId !== "p2-dummy"; i++) {
    const endTurn = result.engine
      .getLegalActions(PlayerId.Player1)
      .find((a) => a.kind === ActionKind.EndTurn);
    if (!endTurn) {
      break;
    }
    result.engine.submitAction(PlayerId.Player1, endTurn);
  }
}

describe("DummyAiController", () => {
  it("plays EndTurn when no move assigned (passive mode)", () => {
    const result = createSandboxBattle(DEFAULT_SANDBOX_CONFIG);
    const dummy = new DummyAiController(result.engine, "p2-dummy", null, Direction.South);

    // Advance to dummy's turn if the player goes first (CT order depends on speed)
    if (result.state.activePokemonId !== "p2-dummy") {
      const playerId = PlayerId.Player1;
      const endTurnAction = result.engine
        .getLegalActions(playerId)
        .find((a) => a.kind === ActionKind.EndTurn);
      if (endTurnAction) {
        result.engine.submitAction(playerId, endTurnAction);
      }
    }

    expect(result.state.activePokemonId).toBe("p2-dummy");
    dummy.playTurn();
    expect(result.state.activePokemonId).not.toBe("p2-dummy");
  });

  it("plays assigned move when legal then ends turn", () => {
    const result = createSandboxBattle({ ...DEFAULT_SANDBOX_CONFIG, dummyMove: "protect" });
    const dummy = new DummyAiController(result.engine, "p2-dummy", "protect", Direction.South);

    skipToDummyTurn(result);
    const events = dummy.playTurn();
    expect(events.length).toBeGreaterThan(0);
    expect(result.state.activePokemonId).not.toBe("p2-dummy");
  });

  it("falls back to EndTurn when assigned move is not legal", () => {
    const result = createSandboxBattle(DEFAULT_SANDBOX_CONFIG);
    const dummy = new DummyAiController(result.engine, "p2-dummy", "fake-move-id", Direction.South);

    skipToDummyTurn(result);
    const events = dummy.playTurn();
    expect(events.length).toBeGreaterThan(0);
    expect(result.state.activePokemonId).not.toBe("p2-dummy");
  });

  it("does nothing when it is not the dummy turn", () => {
    const result = createSandboxBattle(DEFAULT_SANDBOX_CONFIG);
    const dummy = new DummyAiController(result.engine, "p2-dummy", null, Direction.South);

    skipToDummyTurn(result);
    dummy.playTurn();
    skipPlayerTurn(result);

    const activeBefore = result.state.activePokemonId;
    const wrongDummy = new DummyAiController(
      result.engine,
      "p2-nonexistent",
      null,
      Direction.South,
    );
    const events = wrongDummy.playTurn();
    expect(events).toEqual([]);
    expect(result.state.activePokemonId).toBe(activeBefore);
  });
});
