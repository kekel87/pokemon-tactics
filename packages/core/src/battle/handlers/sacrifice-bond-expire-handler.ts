import { BattleEventType } from "../../enums/battle-event-type";
import { StatusType } from "../../enums/status-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import type { PhaseHandler, PhaseResult } from "../turn-pipeline";

const SELF_SACRIFICE_VOLATILES = [StatusType.DestinyBond, StatusType.Grudge] as const;

/**
 * Lien du Destin / Rancune (plan 147) are self-cast volatiles that last "until the caster's next turn".
 * Unlike the enemy-cast timed volatiles (ticked at end of turn), these are cleared at the START of the
 * caster's own next turn — the honest "1 turn of the caster" window. If the caster is KO'd before then,
 * `handleKo` fires the effect while the volatile still holds.
 */
export const sacrificeBondExpireHandler: PhaseHandler = (
  pokemonId: string,
  state: BattleState,
): PhaseResult => {
  const pokemon = state.pokemon.get(pokemonId);
  const events: BattleEvent[] = [];
  if (!pokemon) {
    return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
  }

  for (const type of SELF_SACRIFICE_VOLATILES) {
    const index = pokemon.volatileStatuses.findIndex((v) => v.type === type);
    if (index !== -1) {
      pokemon.volatileStatuses.splice(index, 1);
      events.push({ type: BattleEventType.StatusRemoved, targetId: pokemonId, status: type });
    }
  }

  return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
};
