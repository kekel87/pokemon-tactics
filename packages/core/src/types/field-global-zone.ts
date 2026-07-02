import type { FieldGlobalKind } from "../enums/field-global-kind";
import type { Position } from "./position";

/**
 * A "field global" zone (Gravité / Zone Étrange / Zone Magique). Like Distorsion, the canonical
 * field-wide effect is relocalized to a static Manhattan diamond posted around the caster's tile at
 * cast time. A mon standing on a covered tile is subject to the `kind`'s effect. Stays in place while
 * the caster moves; survives the caster's KO (ghost clock). Counts down on the caster's own turns.
 */
export interface FieldGlobalZone {
  kind: FieldGlobalKind;
  casterId: string;
  /** Tiles covered by the zone (in-bounds Manhattan diamond), frozen at cast time. */
  tiles: Position[];
  /** Caster's tile at cast time — anchor for the timer badge rendering and replace-on-recast. */
  anchor: Position;
  /** Turns left before the zone expires. */
  remainingTurns: number;
}
