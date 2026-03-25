import type { Direction } from "../enums/direction";
import type { Position } from "./position";

export interface PlacementEntry {
  pokemonId: string;
  position: Position;
  direction: Direction;
}
