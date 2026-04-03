import { ActionKind, createPrng, EASY_PROFILE, PlayerId } from "@pokemon-tactic/core";
import { describe, expect, it } from "vitest";
import { AiTeamController } from "./AiTeamController";
import { createBattle } from "./BattleSetup";

function buildAiController() {
  const battleSetup = createBattle();
  const aiController = new AiTeamController(
    battleSetup.engine,
    PlayerId.Player2,
    EASY_PROFILE,
    createPrng(42),
    battleSetup.moveDefinitions,
  );
  return { battleSetup, aiController };
}

function skipToAiTurn(engine: ReturnType<typeof createBattle>["engine"]) {
  for (let i = 0; i < 20; i++) {
    const state = engine.getGameState(PlayerId.Player1);
    const activePokemonId = state.turnOrder[state.currentTurnIndex];
    const activePokemon = activePokemonId ? state.pokemon.get(activePokemonId) : undefined;
    if (activePokemon?.playerId === PlayerId.Player2) {
      return;
    }
    const legalActions = engine.getLegalActions(PlayerId.Player1);
    const endTurn = legalActions.find((a) => a.kind === ActionKind.EndTurn);
    if (!endTurn) {
      break;
    }
    engine.submitAction(PlayerId.Player1, endTurn);
  }
}

describe("AiTeamController", () => {
  it("returns empty events when it is not the AI's turn", () => {
    const { battleSetup, aiController } = buildAiController();
    const state = battleSetup.engine.getGameState(PlayerId.Player1);
    const activePokemonId = state.turnOrder[state.currentTurnIndex];
    const activePokemon = activePokemonId ? state.pokemon.get(activePokemonId) : undefined;

    if (activePokemon?.playerId === PlayerId.Player1) {
      const events = aiController.playTurn();
      expect(events).toEqual([]);
    }
  });

  it("plays a full turn and returns events when it is the AI's turn", () => {
    const { battleSetup, aiController } = buildAiController();
    skipToAiTurn(battleSetup.engine);

    expect(aiController.isAiTurn()).toBe(true);
    const events = aiController.playTurn();
    expect(events.length).toBeGreaterThan(0);
  });
});
