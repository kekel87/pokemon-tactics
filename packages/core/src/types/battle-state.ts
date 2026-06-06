import type { PlayerId } from "../enums/player-id";
import type { TurnSystemKind } from "../enums/turn-system-kind";
import type { Weather } from "../enums/weather";
import type { PokemonInstance } from "./pokemon-instance";
import type { TeamAura } from "./team-aura";
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
  weather: Weather;
  weatherTurnsRemaining: number;
  weatherSetterPokemonId?: string;
  weatherLastTickRound?: number;
  auras: TeamAura[];
  aurasLastTickRound?: number;
  /**
   * Monotonic action clock (B3 conditional-damage moves). Incremented exactly once per
   * completed action in both turn loops (round-based and Charge Time). Per-mon stamps on
   * `PokemonInstance` reference this value so "this turn"-style conditions become integer
   * comparisons that work identically regardless of the turn system.
   */
  actionCounter?: number;
  /** Per-team `actionCounter` of the last time one of the team's mons fainted (Retaliate). */
  lastAllyFaintAtAction?: Partial<Record<PlayerId, number>>;
  /** Per-team move id of the team's most recently completed action (Echoed Voice / Round). */
  lastTeamActionMoveId?: Partial<Record<PlayerId, string>>;
  /** Current Echoed Voice crescendo step (1..5); ramps while the team chains Echoed Voice. */
  echoStreak?: number;
}
