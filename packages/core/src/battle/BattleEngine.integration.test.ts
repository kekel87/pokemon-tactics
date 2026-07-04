import { loadData } from "@pokemon-tactic/data";
import { describe, expect, it } from "vitest";
import { ActionKind } from "../enums/action-kind";
import { BattleEventType } from "../enums/battle-event-type";
import { Direction } from "../enums/direction";
import { PlayerId } from "../enums/player-id";
import { endTurnUntilActor } from "../testing";
import { MockBattle } from "../testing/mock-battle";
import { MockPokemon } from "../testing/mock-pokemon";
import type { BattleEvent } from "../types/battle-event";
import type { MoveDefinition } from "../types/move-definition";
import { BattleEngine } from "./BattleEngine";
import { validateBattleData } from "./validate";

describe("BattleEngine integration", () => {
  it("loads and validates POC data successfully", () => {
    const data = loadData();
    const result = validateBattleData(data);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(data.pokemon.length).toBe(151);
    expect(data.moves.length).toBe(460);
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
      playerId: PlayerId.Player1,
      position: { x: 1, y: 1 },
    };
    const charmander = {
      ...MockPokemon.charmander,
      playerId: PlayerId.Player2,
      position: { x: 6, y: 6 },
    };

    const state = MockBattle.stateFrom([bulbasaur, charmander], 8, 8);
    const engine = new BattleEngine(state, moveRegistry);

    // Charmander has higher base speed (65 > 45) → CT picks it as first actor
    const gameState = engine.getGameState(PlayerId.Player2);
    expect(gameState.activePokemonId).toBe("charmander-1");

    const events: BattleEvent[] = [];
    engine.on(BattleEventType.PokemonMoved, (e) => events.push(e));
    engine.on(BattleEventType.TurnStarted, (e) => events.push(e));
    engine.on(BattleEventType.TurnEnded, (e) => events.push(e));

    const actions = engine.getLegalActions(PlayerId.Player2);
    expect(actions.length).toBeGreaterThan(0);

    const moveActions = actions.filter((a) => a.kind === ActionKind.Move);
    expect(moveActions.length).toBeGreaterThan(0);

    const moveAction = moveActions[0]!;
    expect(moveAction.kind).toBe(ActionKind.Move);

    const result = engine.submitAction(PlayerId.Player2, moveAction);
    expect(result.success).toBe(true);

    const destination = (moveAction as { path: Array<{ x: number; y: number }> }).path.at(-1);
    expect(charmander.position).toEqual(destination);

    // EndTurn for Charmander (Move doesn't end the turn anymore)
    engine.submitAction(PlayerId.Player2, {
      kind: ActionKind.EndTurn,
      pokemonId: "charmander-1",
      direction: Direction.South,
    });

    // Advance the Charge Time scheduler until Bulbasaur is the active actor, then end its turn
    endTurnUntilActor(engine, state, "bulbasaur-1");
    const endTurnResult = engine.submitAction(PlayerId.Player1, {
      kind: ActionKind.EndTurn,
      pokemonId: "bulbasaur-1",
      direction: Direction.South,
    });
    expect(endTurnResult.success).toBe(true);

    const movedEvents = events.filter((e) => e.type === BattleEventType.PokemonMoved);
    expect(movedEvents.length).toBe(1);
  });
});
