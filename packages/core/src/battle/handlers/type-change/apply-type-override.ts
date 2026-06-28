import { BattleEventType } from "../../../enums/battle-event-type";
import type { PokemonType } from "../../../enums/pokemon-type";
import type { BattleEvent, TypeChangeReason } from "../../../types/battle-event";
import type { MoveDefinition } from "../../../types/move-definition";
import type { PokemonInstance } from "../../../types/pokemon-instance";

/**
 * Set a Pokémon's runtime type override (type-manip family) and emit the `TypeChanged` event.
 * `types` may be empty (typeless, e.g. mono-Fire after Flamme Ultime). A new override overwrites any
 * previous one — a mon never carries two overrides at once.
 */
export function applyTypeOverride(
  pokemon: PokemonInstance,
  types: PokemonType[],
  reason: TypeChangeReason,
): BattleEvent[] {
  pokemon.typeOverride = types;
  return [
    {
      type: BattleEventType.TypeChanged,
      pokemonId: pokemon.id,
      newTypes: [...types],
      reason,
    },
  ];
}

/** A move that does nothing this cast — emitted by the type-manip handlers on a failed condition. */
export function typeMoveFailed(attackerId: string, move: MoveDefinition): BattleEvent[] {
  return [{ type: BattleEventType.MoveFailed, attackerId, moveId: move.id }];
}
