import type { AbilityDefinition } from "../types/ability-definition";
import type { PokemonInstance } from "../types/pokemon-instance";

export class AbilityHandlerRegistry {
  private readonly abilities: Map<string, AbilityDefinition>;

  constructor(abilities: AbilityDefinition[]) {
    this.abilities = new Map(abilities.map((a) => [a.id, a]));
  }

  get(id: string): AbilityDefinition | undefined {
    return this.abilities.get(id);
  }

  getForPokemon(pokemon: PokemonInstance): AbilityDefinition | undefined {
    if (!pokemon.abilityId) {
      return undefined;
    }
    return this.abilities.get(pokemon.abilityId);
  }
}
