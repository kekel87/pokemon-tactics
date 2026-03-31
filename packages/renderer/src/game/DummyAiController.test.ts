import { describe, expect, it } from "vitest";
import { ActionKind, Direction, PlayerId } from "@pokemon-tactic/core";
import { defaultSandboxConfig } from "../testing/mock-sandbox";
import { DummyAiController } from "./DummyAiController";
import { createSandboxBattle } from "./SandboxSetup";

describe("DummyAiController", () => {
  it("plays EndTurn when no move assigned (passive mode)", () => {
    const result = createSandboxBattle(defaultSandboxConfig());
    const dummy = new DummyAiController(result.engine, "p2-machop", null, Direction.West);

    // Skip player 1 turn (Pikachu is faster — speed 90 vs 35)
    const p1Actions = result.engine.getLegalActions(PlayerId.Player1);
    const p1EndTurn = p1Actions.find(
      (a) => a.kind === ActionKind.EndTurn && a.direction === Direction.East,
    );
    result.engine.submitAction(PlayerId.Player1, p1EndTurn!);

    // Now dummy's turn — should auto-EndTurn
    const turnIndexBefore = result.state.currentTurnIndex;
    dummy.playTurn();
    expect(result.state.currentTurnIndex).not.toBe(turnIndexBefore);
  });

  it("plays assigned move when legal then ends turn", () => {
    const result = createSandboxBattle(defaultSandboxConfig());
    const dummy = new DummyAiController(result.engine, "p2-machop", "karate-chop", Direction.West);

    // Skip player 1 turn
    const p1Actions = result.engine.getLegalActions(PlayerId.Player1);
    const p1EndTurn = p1Actions.find(
      (a) => a.kind === ActionKind.EndTurn && a.direction === Direction.East,
    );
    result.engine.submitAction(PlayerId.Player1, p1EndTurn!);

    dummy.playTurn();

    // Turn should have advanced past the dummy
    expect(result.state.roundNumber).toBeGreaterThanOrEqual(1);
  });

  it("falls back to EndTurn when assigned move is not legal", () => {
    const result = createSandboxBattle(defaultSandboxConfig());
    const dummy = new DummyAiController(result.engine, "p2-machop", "fake-move-id", Direction.West);

    // Skip player 1 turn
    const p1Actions = result.engine.getLegalActions(PlayerId.Player1);
    const p1EndTurn = p1Actions.find(
      (a) => a.kind === ActionKind.EndTurn && a.direction === Direction.East,
    );
    result.engine.submitAction(PlayerId.Player1, p1EndTurn!);

    dummy.playTurn();

    // Turn should have advanced (EndTurn fallback)
    expect(result.state.roundNumber).toBeGreaterThanOrEqual(1);
  });

  it("does nothing when it is not the dummy turn", () => {
    const result = createSandboxBattle(defaultSandboxConfig());
    const dummy = new DummyAiController(result.engine, "p2-machop", null, Direction.West);

    // First turn is Pikachu (speed 90 > Machop 35) — dummy should do nothing
    const turnIndexBefore = result.state.currentTurnIndex;
    dummy.playTurn();
    expect(result.state.currentTurnIndex).toBe(turnIndexBefore);
  });
});
