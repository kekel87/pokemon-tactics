import type { PokemonInstance } from "./pokemon-instance";
import type { TileState } from "./tile-state";

export interface BattleState {
  grid: TileState[][];
  pokemon: Map<string, PokemonInstance>;
  turnOrder: string[];
  currentTurnIndex: number;
  roundNumber: number;
  predictedNextRoundOrder: string[];
}
