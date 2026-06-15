import {
  ActionKind,
  type AiProfile,
  type BattleEngine,
  type BattleEvent,
  type MoveDefinition,
  type PlayerId,
  pickScoredAction,
  type RandomFn,
} from "@pokemon-tactic/core";

const MAX_ACTIONS_PER_TURN = 10;

export class AiTeamController {
  private readonly engine: BattleEngine;
  private readonly playerId: PlayerId;
  private readonly profile: AiProfile;
  private readonly random: RandomFn;
  private readonly moveRegistry: Map<string, MoveDefinition>;

  constructor(
    engine: BattleEngine,
    playerId: PlayerId,
    profile: AiProfile,
    random: RandomFn,
    moveRegistry: Map<string, MoveDefinition>,
  ) {
    this.engine = engine;
    this.playerId = playerId;
    this.profile = profile;
    this.random = random;
    this.moveRegistry = moveRegistry;
  }

  isAiTurn(): boolean {
    const state = this.engine.getGameState(this.playerId);
    const activePokemonId = state.turnOrder[state.currentTurnIndex];
    if (!activePokemonId) {
      return false;
    }
    const pokemon = state.pokemon.get(activePokemonId);
    return pokemon?.playerId === this.playerId;
  }

  playTurn(): BattleEvent[] {
    const allEvents: BattleEvent[] = [];

    if (!this.isAiTurn()) {
      return allEvents;
    }

    let actionsPlayed = 0;

    while (actionsPlayed < MAX_ACTIONS_PER_TURN) {
      const legalActions = this.engine.getLegalActions(this.playerId);
      if (legalActions.length === 0) {
        break;
      }

      const state = this.engine.getGameState(this.playerId);
      const action = pickScoredAction(
        legalActions,
        state,
        this.moveRegistry,
        this.engine,
        this.profile,
        this.random,
      );

      const result = this.engine.submitAction(this.playerId, action);
      actionsPlayed++;

      if (result.success) {
        allEvents.push(...result.events);
      }

      if (action.kind === ActionKind.EndTurn) {
        break;
      }
    }

    return allEvents;
  }
}
