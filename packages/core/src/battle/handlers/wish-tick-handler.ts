import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import { isHealBlocked } from "../heal-block-system";
import type { PhaseHandler, PhaseResult } from "../turn-pipeline";

/**
 * Fires a pending Wish heal at the start of the target's turn (B2 healing). Runs after the action
 * clock ticks (beginActorTurn), so `actionCounter > castAtAction` guarantees the heal lands on the
 * target's NEXT turn, never the cast turn. Model-agnostic (round & CT).
 */
export const wishTickHandler: PhaseHandler = (
  pokemonId: string,
  state: BattleState,
): PhaseResult => {
  const events: BattleEvent[] = [];
  const pokemon = state.pokemon.get(pokemonId);
  if (!pokemon || pokemon.pendingWish === undefined || pokemon.currentHp <= 0) {
    return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
  }

  const { healAmount, castAtAction } = pokemon.pendingWish;
  if ((state.actionCounter ?? 0) <= castAtAction) {
    return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
  }

  pokemon.pendingWish = undefined;
  // Anti-Soin (Heal Block): the Wish still fires on schedule but is wasted (no heal).
  if (isHealBlocked(pokemon)) {
    events.push({ type: BattleEventType.HealPrevented, pokemonId });
    return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
  }
  const healed = Math.min(pokemon.maxHp - pokemon.currentHp, healAmount);
  if (healed > 0) {
    pokemon.currentHp += healed;
    events.push({ type: BattleEventType.WishHealed, pokemonId, amount: healed });
  }
  return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
};
