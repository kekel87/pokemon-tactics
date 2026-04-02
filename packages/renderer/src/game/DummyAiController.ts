import {
  ActionKind,
  type BattleEngine,
  type BattleEvent,
  type Direction,
  PlayerId,
} from "@pokemon-tactic/core";

export class DummyAiController {
  private readonly engine: BattleEngine;
  private readonly dummyPokemonId: string;
  private readonly assignedMoveId: string | null;
  private readonly direction: Direction;

  constructor(
    engine: BattleEngine,
    dummyPokemonId: string,
    assignedMoveId: string | null,
    direction: Direction,
  ) {
    this.engine = engine;
    this.dummyPokemonId = dummyPokemonId;
    this.assignedMoveId = assignedMoveId;
    this.direction = direction;
  }

  private isDummyTurn(): boolean {
    const state = this.engine.getGameState(PlayerId.Player2);
    const activePokemonId = state.turnOrder[state.currentTurnIndex];
    return activePokemonId === this.dummyPokemonId;
  }

  playTurn(): BattleEvent[] {
    const allEvents: BattleEvent[] = [];

    if (!this.isDummyTurn()) {
      return allEvents;
    }

    if (this.assignedMoveId) {
      const legalActions = this.engine.getLegalActions(PlayerId.Player2);
      const moveAction = legalActions.find(
        (action) => action.kind === ActionKind.UseMove && action.moveId === this.assignedMoveId,
      );
      if (moveAction) {
        const result = this.engine.submitAction(PlayerId.Player2, moveAction);
        if (result.success) {
          allEvents.push(...result.events);
        }
      }
    }

    const postActions = this.engine.getLegalActions(PlayerId.Player2);
    const endTurnAction = postActions.find(
      (action) => action.kind === ActionKind.EndTurn && action.direction === this.direction,
    );

    if (endTurnAction) {
      const result = this.engine.submitAction(PlayerId.Player2, endTurnAction);
      if (result.success) {
        allEvents.push(...result.events);
      }
    }

    return allEvents;
  }
}
