import { OCCLUSION_MAX_TILE_DISTANCE, OCCLUSION_MIN_TILE_ELEVATION } from "../constants";

export interface OcclusionCandidateTile {
  x: number;
  y: number;
  elevation: number;
}

export interface OcclusionSubjectPosition {
  x: number;
  y: number;
}

export function isOccludedBy(
  pokemon: OcclusionSubjectPosition,
  tile: OcclusionCandidateTile,
): boolean {
  const pokemonDepth = pokemon.x + pokemon.y;
  const tileDepth = tile.x + tile.y;
  const distance = tileDepth - pokemonDepth;
  if (distance <= 0) {
    return false;
  }
  if (distance > OCCLUSION_MAX_TILE_DISTANCE) {
    return false;
  }
  if (tile.elevation < OCCLUSION_MIN_TILE_ELEVATION) {
    return false;
  }
  const pokemonColumn = pokemon.x - pokemon.y;
  const tileColumn = tile.x - tile.y;
  if (Math.abs(tileColumn - pokemonColumn) > 1) {
    return false;
  }
  return true;
}
