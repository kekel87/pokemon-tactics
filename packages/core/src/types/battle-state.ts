import type { PlayerId } from "../enums/player-id";
import type { Weather } from "../enums/weather";
import type { DistortionZone } from "./distortion-zone";
import type { EntryHazardCell } from "./entry-hazard-cell";
import type { FieldZone } from "./field-zone";
import type { PendingStrike } from "./pending-strike";
import type { PokemonInstance } from "./pokemon-instance";
import type { TeamAura } from "./team-aura";
import type { TileState } from "./tile-state";

export interface BattleState {
  grid: TileState[][];
  pokemon: Map<string, PokemonInstance>;
  /** Id of the Pokemon whose turn it currently is (Charge Time scheduler). */
  activePokemonId: string;
  ctSnapshot?: Record<string, number>;
  weather: Weather;
  weatherTurnsRemaining: number;
  weatherSetterPokemonId?: string;
  auras: TeamAura[];
  /** Painted field-terrain zones ("Champs", B4). Multiple coexist; latest wins per tile on overlap. */
  fieldTerrains: FieldZone[];
  /** Trick Room ("Distorsion") zones: inside one, CT tempo is inverted (slow acts first). */
  distortionZones: DistortionZone[];
  /** Entry-hazard traps (Picots / Pièges de Roc / Pics Toxik / Toile Gluante). Permanent until removed. */
  entryHazards: EntryHazardCell[];
  /** Tile-bound delayed strikes scheduled by future-moves (Prescience). Resolve after a caster-turn delay. */
  pendingStrikes: PendingStrike[];
  /**
   * Monotonic action clock. Incremented exactly once per completed action by the Charge Time turn
   * loop. Per-mon stamps on `PokemonInstance` reference this value so "this turn"-style conditions
   * (and effect durations counted on the setter's own turns) become integer comparisons.
   */
  actionCounter?: number;
  /** Per-team `actionCounter` of the last time one of the team's mons fainted (Retaliate). */
  lastAllyFaintAtAction?: Partial<Record<PlayerId, number>>;
  /** Per-team move id of the team's most recently completed action (Echoed Voice / Round). */
  lastTeamActionMoveId?: Partial<Record<PlayerId, string>>;
  /** Current Echoed Voice crescendo step (1..5); ramps while the team chains Echoed Voice. */
  echoStreak?: number;
}
