import type { FieldTerrain } from "../enums/field-terrain";
import type { Position } from "./position";

/**
 * A painted field-terrain zone (B4). Posted by a setter move as a static Manhattan diamond around
 * the caster's tile at cast time. Stays in place while the caster moves; survives the caster's KO.
 * Multiple zones coexist — on overlap, the most recently posted wins per tile (see getFieldTerrainAt).
 */
export interface FieldZone {
  kind: FieldTerrain;
  casterId: string;
  /** Tiles covered by the zone (in-bounds Manhattan diamond), frozen at cast time. */
  tiles: Position[];
  /** Caster's tile at cast time — anchor for the timer badge rendering. */
  anchor: Position;
  /** Turns left before the zone expires (5, or 8 with Terrain Extender). */
  remainingTurns: number;
}
