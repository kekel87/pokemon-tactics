import type { HeldItemId } from "../enums/held-item-id";
import type { Nature } from "../enums/nature";
import type { PokemonGender } from "../enums/pokemon-gender";
import type { StatSpread } from "../types/stat-spread";

export interface TeamSlot {
  pokemonId: string;
  ability: string;
  heldItemId?: HeldItemId;
  nature: Nature;
  moveIds: string[];
  statSpread: StatSpread;
  gender?: PokemonGender;
}
