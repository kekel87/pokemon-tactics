import { BattleEventType } from "../../enums/battle-event-type";
import { StatusType } from "../../enums/status-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import { isHealBlocked } from "../heal-block-system";
import type { PhaseHandler, PhaseResult } from "../turn-pipeline";

const AQUA_RING_FRACTION = 16;
const INGRAIN_FRACTION = 8;

function applyHeal(
  pokemon: { currentHp: number; maxHp: number; id: string },
  fraction: number,
): BattleEvent | undefined {
  if (pokemon.currentHp >= pokemon.maxHp) {
    return undefined;
  }
  const heal = Math.min(
    pokemon.maxHp - pokemon.currentHp,
    Math.max(1, Math.floor(pokemon.maxHp / fraction)),
  );
  if (heal <= 0) {
    return undefined;
  }
  pokemon.currentHp += heal;
  return { type: BattleEventType.HpRestored, pokemonId: pokemon.id, amount: heal };
}

/**
 * Heal-over-time end-turn tick (B2 healing): Aqua Ring heals 1/16 unconditionally. Ingrain heals
 * 1/8 while the mon stays put — any displacement (own movement, knockback, ice slide) since the
 * last tick UPROOTS it: the Ingrain volatile is removed and no heal occurs that turn.
 * Runs after Leech Seed (200), before traps (300).
 */
export const hotTickHandler: PhaseHandler = (
  pokemonId: string,
  state: BattleState,
): PhaseResult => {
  const events: BattleEvent[] = [];
  const pokemon = state.pokemon.get(pokemonId);
  if (!pokemon || pokemon.currentHp <= 0) {
    return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
  }

  const hasAquaRing = pokemon.volatileStatuses.some((v) => v.type === StatusType.AquaRing);
  const ingrainIndex = pokemon.volatileStatuses.findIndex((v) => v.type === StatusType.Ingrain);
  // Anti-Soin (Heal Block): the HoT volatiles persist but their ticks are suspended.
  const blocked = isHealBlocked(pokemon);

  if (hasAquaRing && !blocked) {
    const event = applyHeal(pokemon, AQUA_RING_FRACTION);
    if (event) {
      events.push(event);
    }
  }

  if (ingrainIndex !== -1) {
    if (pokemon.movedThisTurn === true) {
      // Moved since the last tick → the roots are torn out (Racines ends).
      pokemon.volatileStatuses.splice(ingrainIndex, 1);
      events.push({
        type: BattleEventType.StatusRemoved,
        targetId: pokemon.id,
        status: StatusType.Ingrain,
      });
    } else if (!blocked) {
      const event = applyHeal(pokemon, INGRAIN_FRACTION);
      if (event) {
        events.push(event);
      }
    }
  }

  // Consume the movement flag for the next window.
  pokemon.movedThisTurn = false;

  return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
};
