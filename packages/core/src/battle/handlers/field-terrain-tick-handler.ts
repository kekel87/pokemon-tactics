import { BattleEventType } from "../../enums/battle-event-type";
import { FieldTerrain } from "../../enums/field-terrain";
import type { PokemonType } from "../../enums/pokemon-type";
import type { BattleEvent } from "../../types/battle-event";
import type { BattleState } from "../../types/battle-state";
import {
  decrementFieldTerrainsTimer,
  GRASSY_HEAL_FRACTION,
  isOnFieldTerrain,
} from "../field-terrain-system";
import type { PhaseHandler, PhaseResult } from "../turn-pipeline";

const EMPTY_RESULT: PhaseResult = {
  events: [],
  skipAction: false,
  restrictActions: false,
  pokemonFainted: false,
};

/**
 * Grassy Terrain end-turn heal (B4): a grounded mon standing on a Grassy zone regains 1/16 max HP.
 * Per-mon; the zone timers are decremented separately (createFieldTerrainDecrementHandler).
 */
export function createFieldTerrainHealHandler(
  pokemonTypesMap: Map<string, PokemonType[]>,
): PhaseHandler {
  return (pokemonId: string, state: BattleState): PhaseResult => {
    const pokemon = state.pokemon.get(pokemonId);
    if (!pokemon || pokemon.currentHp <= 0) {
      return EMPTY_RESULT;
    }
    const types = pokemonTypesMap.get(pokemon.definitionId) ?? [];
    if (!isOnFieldTerrain(state, pokemon, types, FieldTerrain.Grassy)) {
      return EMPTY_RESULT;
    }
    if (pokemon.currentHp >= pokemon.maxHp) {
      return EMPTY_RESULT;
    }
    const heal = Math.min(
      pokemon.maxHp - pokemon.currentHp,
      Math.max(1, Math.floor(pokemon.maxHp / GRASSY_HEAL_FRACTION)),
    );
    pokemon.currentHp += heal;
    return {
      events: [{ type: BattleEventType.HpRestored, pokemonId: pokemon.id, amount: heal }],
      skipAction: false,
      restrictActions: false,
      pokemonFainted: false,
    };
  };
}

/**
 * Decrement the field-terrain zones posted by the acting mon (duration model "tours du lanceur":
 * a zone counts down on its caster's own turn) and emit a FieldTerrainExpired event for each zone
 * that reached zero.
 */
export function fieldTerrainDecrementHandler(pokemonId: string, state: BattleState): PhaseResult {
  if (state.fieldTerrains.length === 0) {
    return EMPTY_RESULT;
  }
  const expired = decrementFieldTerrainsTimer(state, pokemonId);
  if (expired.length === 0) {
    return EMPTY_RESULT;
  }
  const events: BattleEvent[] = expired.map((entry) => ({
    type: BattleEventType.FieldTerrainExpired,
    casterId: entry.casterId,
    kind: entry.kind,
  }));
  return { events, skipAction: false, restrictActions: false, pokemonFainted: false };
}
