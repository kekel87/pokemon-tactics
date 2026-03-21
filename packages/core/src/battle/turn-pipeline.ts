import type { BattleEvent } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";

export interface PhaseResult {
  events: BattleEvent[];
  skipAction: boolean;
  restrictActions: boolean;
  pokemonFainted: boolean;
}

export type PhaseHandler = (pokemonId: string, state: BattleState) => PhaseResult;

interface RegisteredHandler {
  handler: PhaseHandler;
  priority: number;
}

function emptyResult(): PhaseResult {
  return { events: [], skipAction: false, restrictActions: false, pokemonFainted: false };
}

function mergeResults(accumulated: PhaseResult, next: PhaseResult): PhaseResult {
  return {
    events: [...accumulated.events, ...next.events],
    skipAction: accumulated.skipAction || next.skipAction,
    restrictActions: accumulated.restrictActions || next.restrictActions,
    pokemonFainted: accumulated.pokemonFainted || next.pokemonFainted,
  };
}

export class TurnPipeline {
  private readonly startTurnHandlers: RegisteredHandler[] = [];
  private readonly endTurnHandlers: RegisteredHandler[] = [];

  registerStartTurn(handler: PhaseHandler, priority: number): void {
    this.startTurnHandlers.push({ handler, priority });
    this.startTurnHandlers.sort((a, b) => a.priority - b.priority);
  }

  registerEndTurn(handler: PhaseHandler, priority: number): void {
    this.endTurnHandlers.push({ handler, priority });
    this.endTurnHandlers.sort((a, b) => a.priority - b.priority);
  }

  unregisterStartTurn(handler: PhaseHandler): void {
    const index = this.startTurnHandlers.findIndex((h) => h.handler === handler);
    if (index !== -1) {
      this.startTurnHandlers.splice(index, 1);
    }
  }

  unregisterEndTurn(handler: PhaseHandler): void {
    const index = this.endTurnHandlers.findIndex((h) => h.handler === handler);
    if (index !== -1) {
      this.endTurnHandlers.splice(index, 1);
    }
  }

  executeStartTurn(pokemonId: string, state: BattleState): PhaseResult {
    return this.executeHandlers(this.startTurnHandlers, pokemonId, state);
  }

  executeEndTurn(pokemonId: string, state: BattleState): PhaseResult {
    return this.executeHandlers(this.endTurnHandlers, pokemonId, state);
  }

  private executeHandlers(
    handlers: RegisteredHandler[],
    pokemonId: string,
    state: BattleState,
  ): PhaseResult {
    let result = emptyResult();

    for (const registered of handlers) {
      const handlerResult = registered.handler(pokemonId, state);
      result = mergeResults(result, handlerResult);

      if (result.pokemonFainted) {
        break;
      }
    }

    return result;
  }
}
