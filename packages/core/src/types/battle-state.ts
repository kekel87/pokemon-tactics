import type { TurnSystemKind } from "../enums/turn-system-kind";
import type { PokemonInstance } from "./pokemon-instance";
import type { TileState } from "./tile-state";

export interface BattleState {
  grid: TileState[][];
  pokemon: Map<string, PokemonInstance>;
  turnOrder: string[];
  currentTurnIndex: number;
  roundNumber: number;
  predictedNextRoundOrder: string[];
  turnSystemKind?: TurnSystemKind;
  ctSnapshot?: Record<string, number>;
}
