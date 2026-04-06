import type { PokemonInstance } from "../types/pokemon-instance";

type InitiativeFunction = (pokemon: PokemonInstance) => number;

const defaultGetInitiative: InitiativeFunction = (pokemon: PokemonInstance): number =>
  pokemon.derivedStats.initiative;

export class TurnManager {
  private turnOrder: string[];
  private currentIndex: number;

  constructor(
    pokemon: PokemonInstance[],
    getInitiative: InitiativeFunction = defaultGetInitiative,
  ) {
    this.turnOrder = TurnManager.sortByInitiative(pokemon, getInitiative);
    this.currentIndex = 0;
  }

  getCurrentPokemonId(): string {
    const pokemonId = this.turnOrder[this.currentIndex];
    if (pokemonId === undefined) {
      throw new Error("No active pokemon in turn order");
    }
    return pokemonId;
  }

  advance(): void {
    this.currentIndex++;
  }

  isRoundComplete(): boolean {
    return this.currentIndex >= this.turnOrder.length;
  }

  startNewRound(): void {
    this.currentIndex = 0;
  }

  recalculateOrder(pokemon: PokemonInstance[], getInitiative: InitiativeFunction): void {
    this.turnOrder = TurnManager.sortByInitiative(pokemon, getInitiative);
  }

  removePokemon(pokemonId: string): void {
    const removedIndex = this.turnOrder.indexOf(pokemonId);
    if (removedIndex === -1) {
      return;
    }

    this.turnOrder = this.turnOrder.filter((id) => id !== pokemonId);

    if (this.turnOrder.length === 0) {
      return;
    }

    if (removedIndex < this.currentIndex) {
      this.currentIndex--;
    } else if (removedIndex === this.currentIndex && this.currentIndex >= this.turnOrder.length) {
      this.currentIndex = 0;
    }
  }

  getTurnOrder(): string[] {
    return [...this.turnOrder];
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  private static sortByInitiative(
    pokemon: PokemonInstance[],
    getInitiative: InitiativeFunction,
  ): string[] {
    const sorted = [...pokemon].sort((a, b) => {
      const initiativeDiff = getInitiative(b) - getInitiative(a);
      if (initiativeDiff !== 0) {
        return initiativeDiff;
      }
      return a.id.localeCompare(b.id);
    });
    return sorted.map((p) => p.id);
  }
}
