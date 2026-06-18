import type { Position } from "./position";

/**
 * A Trick Room ("Distorsion") zone. Unlike the canonical field-wide Trick Room, this project
 * localizes it (decision: mirror screens→aura / terrains→zone): a static Manhattan diamond posted
 * around the caster's tile at cast time. A grounded OR airborne mon standing on a covered tile has
 * its Charge Time tempo inverted (slow acts first). Stays in place while the caster moves; survives
 * the caster's KO (ghost clock). Counts down on the caster's own turns ("tours du lanceur").
 */
export interface DistortionZone {
  casterId: string;
  /** Tiles covered by the zone (in-bounds Manhattan diamond), frozen at cast time. */
  tiles: Position[];
  /** Caster's tile at cast time — anchor for the timer badge rendering. */
  anchor: Position;
  /** Turns left before the zone expires. */
  remainingTurns: number;
}
