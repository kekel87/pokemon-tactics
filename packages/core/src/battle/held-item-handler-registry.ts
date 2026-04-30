import type { HeldItemDefinition } from "../types/held-item-definition";
import type { PokemonInstance } from "../types/pokemon-instance";

export class HeldItemHandlerRegistry {
  private readonly items: Map<string, HeldItemDefinition>;

  constructor(items: HeldItemDefinition[]) {
    this.items = new Map(items.map((i) => [i.id, i]));
  }

  get(id: string): HeldItemDefinition | undefined {
    return this.items.get(id);
  }

  getForPokemon(pokemon: PokemonInstance): HeldItemDefinition | undefined {
    if (!pokemon.heldItemId) {
      return undefined;
    }
    return this.items.get(pokemon.heldItemId);
  }
}
