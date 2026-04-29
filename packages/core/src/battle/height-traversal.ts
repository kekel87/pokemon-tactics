import { isTerrainPassable, TerrainType } from "../enums/terrain-type";

const MAX_CLIMB = 0.5;
const MAX_DESCENT = 1.0;

export interface TraversalOptions {
  readonly fromHeight: number;
  readonly toHeight: number;
  readonly fromTerrain: TerrainType;
  readonly toTerrain: TerrainType;
  readonly isFlying: boolean;
  readonly isGhost: boolean;
  readonly immuneTerrains?: ReadonlySet<TerrainType>;
}

export function canEnterTerrain(
  terrain: TerrainType,
  isFlying: boolean,
  isGhost: boolean,
  immuneTerrains?: ReadonlySet<TerrainType>,
): boolean {
  if (terrain === TerrainType.Obstacle) {
    return isFlying || isGhost;
  }
  if (!isTerrainPassable(terrain)) {
    return isFlying || (immuneTerrains?.has(terrain) ?? false);
  }
  return true;
}

export function canTraverse(options: TraversalOptions): boolean {
  const { fromHeight, toHeight, fromTerrain, toTerrain, isFlying, isGhost, immuneTerrains } =
    options;

  if (!canEnterTerrain(toTerrain, isFlying, isGhost, immuneTerrains)) {
    return false;
  }

  if (isGhost && (fromTerrain === TerrainType.Obstacle || toTerrain === TerrainType.Obstacle)) {
    return true;
  }

  if (isFlying) {
    return true;
  }

  const delta = toHeight - fromHeight;
  if (delta > 0) {
    return delta <= MAX_CLIMB;
  }
  return -delta <= MAX_DESCENT;
}

export function canStopOn(
  terrain: TerrainType,
  isFlying: boolean,
  immuneTerrains?: ReadonlySet<TerrainType>,
): boolean {
  if (terrain === TerrainType.Obstacle) {
    return isFlying;
  }
  if (!isTerrainPassable(terrain)) {
    return immuneTerrains?.has(terrain) ?? false;
  }
  return true;
}
