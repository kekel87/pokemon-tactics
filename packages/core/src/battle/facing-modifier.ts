import { Direction } from "../enums/direction";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import { directionFromTo } from "../utils/direction";

export const FacingZone = {
  Front: "front",
  Flank: "flank",
  Back: "back",
} as const;

export type FacingZone = (typeof FacingZone)[keyof typeof FacingZone];

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  [Direction.North]: Direction.South,
  [Direction.South]: Direction.North,
  [Direction.East]: Direction.West,
  [Direction.West]: Direction.East,
};

const FACING_MODIFIERS: Record<FacingZone, number> = {
  [FacingZone.Front]: 0.85,
  [FacingZone.Flank]: 1.0,
  [FacingZone.Back]: 1.15,
};

export function getOppositeDirection(direction: Direction): Direction {
  return OPPOSITE_DIRECTION[direction];
}

export function getFacingZone(attackOrigin: Position, defender: PokemonInstance): FacingZone {
  const attackDirection = directionFromTo(attackOrigin, defender.position);

  if (attackDirection === defender.orientation) {
    return FacingZone.Back;
  }

  if (attackDirection === OPPOSITE_DIRECTION[defender.orientation]) {
    return FacingZone.Front;
  }

  return FacingZone.Flank;
}

export function getFacingModifier(zone: FacingZone): number {
  return FACING_MODIFIERS[zone];
}
