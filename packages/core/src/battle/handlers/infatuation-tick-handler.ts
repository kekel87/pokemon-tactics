import { BattleEventType } from "../../enums/battle-event-type";
import { StatusType } from "../../enums/status-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import type { RandomFn } from "../../utils/prng";
import type { PhaseHandler, PhaseResult } from "../turn-pipeline";

export function createInfatuationTickHandler(random: RandomFn = () => Math.random()): PhaseHandler {
  return (pokemonId: string, state: BattleState): PhaseResult => {
    const pokemon = state.pokemon.get(pokemonId);
    const empty: PhaseResult = {
      events: [],
      skipAction: false,
      restrictActions: false,
      pokemonFainted: false,
    };

    if (!pokemon) {
      return empty;
    }
    const infatuated = pokemon.volatileStatuses.find((v) => v.type === StatusType.Infatuated);
    if (!infatuated || !infatuated.sourceId) {
      return empty;
    }

    const events: BattleEvent[] = [];
    if (random() < 0.5) {
      events.push({
        type: BattleEventType.InfatuationTriggered,
        pokemonId,
        sourceId: infatuated.sourceId,
      });
      return { events, skipAction: true, restrictActions: false, pokemonFainted: false };
    }

    events.push({
      type: BattleEventType.InfatuationResisted,
      pokemonId,
      sourceId: infatuated.sourceId,
    });
    return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
  };
}
