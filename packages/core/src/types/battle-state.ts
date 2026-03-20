import type { ActiveLink } from "./active-link";
import type { PokemonInstance } from "./pokemon-instance";
import type { TileState } from "./tile-state";

export interface BattleState {
  grid: TileState[][];
  pokemon: Map<string, PokemonInstance>;
  activeLinks: ActiveLink[];
  turnOrder: string[];
  currentTurnIndex: number;
  roundNumber: number;
}
