import type { ActionError } from "../enums/action-error";
import type { ActionKind } from "../enums/action-kind";
import type { Direction } from "../enums/direction";
import type { BattleEvent } from "./battle-event";
import type { Position } from "./position";

export type Action =
  | { kind: typeof ActionKind.Move; pokemonId: string; path: Position[] }
  | { kind: typeof ActionKind.UseMove; pokemonId: string; moveId: string; targetPosition: Position }
  | { kind: typeof ActionKind.EndTurn; pokemonId: string; direction: Direction }
  | { kind: typeof ActionKind.UndoMove; pokemonId: string };

export interface ActionResult {
  success: boolean;
  events: BattleEvent[];
  error?: ActionError;
}
