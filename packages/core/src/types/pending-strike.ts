import type { PlayerId } from "../enums/player-id";
import type { PokemonType } from "../enums/pokemon-type";
import type { Position } from "./position";

/**
 * A tile-bound delayed strike scheduled by a future-move (Prescience / future-sight, plan 133).
 *
 * Targeting is ground-based: the cast locks a tile, and after `turnsRemaining` of the CASTER's own
 * turns elapse, the strike lands as an AoE around `centerPosition` (Manhattan `radius`). The caster's
 * offensive context is frozen at cast (`frozenOffense`); the defensive side (type effectiveness,
 * Def/SpD) is recomputed per occupant at landing. Friendly fire is intentional: any living Pokemon
 * inside the area is hit, allies of the caster included. If the locked area is empty at landing, the
 * strike fizzles. If the caster faints before landing, the caster keeps a ghost slot in the CT
 * scheduler (cf. weather, plan 128) so the strike still resolves.
 */
export interface PendingStrike {
  /** The locked center tile; the strike lands here (+ AoE radius). */
  centerPosition: Position;
  /** Manhattan radius of the area struck at landing. */
  radius: number;
  /** Caster offense frozen at cast time. Damage is computed against each defender's live defense. */
  frozenOffense: {
    /** Effective Special Attack (base stat with stages applied) at cast. */
    specialAttack: number;
    /** Move base power. */
    power: number;
    /** Move type (Psychic for Prescience). */
    moveType: PokemonType;
    /** STAB multiplier frozen from the caster's types at cast (1 or 1.5). */
    stabMultiplier: number;
  };
  /** Caster Pokemon id (used to count the caster's own turns; ghost-scheduled if KO'd). */
  casterId: string;
  /** Caster player id (log/AI only; NOT a damage owner filter — friendly fire is intended). */
  casterPlayerId: PlayerId;
  /** Caster's own turns left before the strike lands. */
  turnsRemaining: number;
}
