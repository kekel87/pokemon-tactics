import { HeldItemId } from "../enums/held-item-id";
import type { BattleState } from "../types/battle-state";
import type { PokemonInstance } from "../types/pokemon-instance";
import { isHeldItemSuppressed } from "./field-global-system";

const FLOAT_STONE_WEIGHT_MOD = 0.5;

/**
 * The body weight (kg) a mon has right now: the Morphing/Imposteur copy (`transformState.weight`,
 * plan 157) when transformed, otherwise its species `weight`, then halved by Pierrallégée
 * (`float-stone`). Drives weight-based move power (Grosse Puissance / Fracasser). Read directly from
 * `heldItemId` (no registry on this path). Pass `state` during real resolution so a holder standing
 * in a Zone Magique (magic-room) loses the halving; omit it in tooltip previews (no zone context).
 */
export function effectiveWeight(pokemon: PokemonInstance, state?: BattleState): number {
  const base = pokemon.transformState?.weight ?? pokemon.weight;
  const floatStoneActive =
    pokemon.heldItemId === HeldItemId.FloatStone &&
    !(state && isHeldItemSuppressed(state, pokemon));
  if (floatStoneActive) {
    return base * FLOAT_STONE_WEIGHT_MOD;
  }
  return base;
}
