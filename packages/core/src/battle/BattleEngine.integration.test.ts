import { describe, expect, it } from "vitest";
import { loadData } from "@pokemon-tactic/data";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import type { BattleEvent } from "../types/battle-event";
import type { MoveDefinition } from "../types/move-definition";
import { MockBattle } from "../testing/mock-battle";
import { MockPokemon } from "../testing/mock-pokemon";
import { BattleEngine } from "./BattleEngine";
import { validateBattleData } from "./validate";

describe("BattleEngine integration", () => {
  it("loads and validates POC data successfully", () => {
    const data = loadData();
    const result = validateBattleData(data);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(data.pokemon.length).toBe(4);
    expect(data.moves.length).toBe(16);
  });

  it("runs a full headless combat cycle", () => {
    const data = loadData();

    const moveRegistry = new Map<string, MoveDefinition>();
    for (const move of data.moves) {
      moveRegistry.set(move.id, move);
    }

    // Bulbasaur (player-1) vs Charmander (player-2) on 8x8 grid
    const bulbasaur = {
      ...MockPokemon.bulbasaur,
      playerId: "player-1",
      position: { x: 1, y: 1 },
    };
    const charmander = {
      ...MockPokemon.charmander,
      playerId: "player-2",
      position: { x: 6, y: 6 },
    };

    const state = MockBattle.stateFrom([bulbasaur, charmander], 8, 8);
    const engine = new BattleEngine(state, moveRegistry);

    // Charmander has higher initiative (65 > 45)
    const gameState = engine.getGameState("player-2");
    expect(gameState.turnOrder[0]).toBe("charmander-1");

    const events: BattleEvent[] = [];
    engine.on(BattleEventType.PokemonMoved, (e) => events.push(e));
    engine.on(BattleEventType.TurnStarted, (e) => events.push(e));
    engine.on(BattleEventType.TurnEnded, (e) => events.push(e));

    const actions = engine.getLegalActions("player-2");
    expect(actions.length).toBeGreaterThan(0);

    const moveActions = actions.filter((a) => a.kind === ActionKind.Move);
    expect(moveActions.length).toBeGreaterThan(0);

    const moveAction = moveActions[0]!;
    expect(moveAction.kind).toBe(ActionKind.Move);

    const result = engine.submitAction("player-2", moveAction);
    expect(result.success).toBe(true);

    const destination = (moveAction as { path: Array<{ x: number; y: number }> }).path.at(-1);
    expect(charmander.position).toEqual(destination);

    const skipResult = engine.submitAction("player-1", {
      kind: ActionKind.SkipTurn,
      pokemonId: "bulbasaur-1",
    });
    expect(skipResult.success).toBe(true);

    expect(state.roundNumber).toBe(2);

    const movedEvents = events.filter((e) => e.type === BattleEventType.PokemonMoved);
    expect(movedEvents.length).toBe(1);
  });
});
