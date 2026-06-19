import { BattleEventType } from "../../enums/battle-event-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import { manhattanDistance } from "../../utils/manhattan-distance";
import type { PhaseHandler, PhaseResult } from "../turn-pipeline";

const EMPTY_RESULT: PhaseResult = {
  events: [],
  skipAction: false,
  restrictActions: false,
  pokemonFainted: false,
};

/**
 * Requiem (perish-song) death-aura tick. Counts the caster's own aura down on the caster's turn; when
 * it reaches 0 the aura detonates: every living mon within the (mobile) Manhattan radius of the
 * caster's CURRENT position faints — allies, enemies and the caster itself. The aura follows the
 * caster, so where it detonates depends on where the caster stands at expiry.
 */
export const perishTickHandler: PhaseHandler = (
  pokemonId: string,
  state: BattleState,
): PhaseResult => {
  const caster = state.pokemon.get(pokemonId);
  if (!caster || caster.currentHp <= 0 || caster.perishAura === undefined) {
    return EMPTY_RESULT;
  }

  caster.perishAura.turnsRemaining -= 1;
  if (caster.perishAura.turnsRemaining > 0) {
    return {
      events: [
        {
          type: BattleEventType.PerishAuraTick,
          casterId: caster.id,
          turns: caster.perishAura.turnsRemaining,
        },
      ],
      skipAction: false,
      restrictActions: false,
      pokemonFainted: false,
    };
  }

  const radius = caster.perishAura.radius;
  caster.perishAura = undefined;
  const events: BattleEvent[] = [];
  let casterFainted = false;
  for (const victim of state.pokemon.values()) {
    if (victim.currentHp <= 0) {
      continue;
    }
    if (manhattanDistance(caster.position, victim.position) > radius) {
      continue;
    }
    victim.currentHp = 0;
    events.push({ type: BattleEventType.PerishKo, pokemonId: victim.id });
    events.push({ type: BattleEventType.PokemonKo, pokemonId: victim.id, countdownStart: 0 });
    if (victim.id === caster.id) {
      casterFainted = true;
    }
  }
  return {
    events,
    skipAction: casterFainted,
    restrictActions: false,
    pokemonFainted: events.length > 0,
  };
};
