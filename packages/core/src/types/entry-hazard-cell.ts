import type { EntryHazardKind } from "../enums/entry-hazard-kind";
import type { Position } from "./position";

/**
 * An entry-hazard trap occupying a SINGLE tile (plan 131). Unlike canonical Pokemon hazards (one
 * stack per side, triggered on switch-in), this project adapts them to a tactical grid: each cast
 * places one trapped tile, and a Pokemon entering it (during movement) triggers the effect. Building
 * a minefield is a multi-turn investment. Permanent until removed (Rapid Spin / Defog). Team-agnostic
 * (decision 2026-06-18): a trap affects ANY mon that enters it, allies included — double-edged.
 */
export interface EntryHazardCell {
  kind: EntryHazardKind;
  /** The single trapped tile. */
  tile: Position;
  /** Stacked layers (Picots up to 3, Pics Toxik up to 2, others 1). Higher = stronger. */
  layers: number;
}
