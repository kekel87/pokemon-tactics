import { BattleEventType } from "../enums/battle-event-type";
import type { PokemonType } from "../enums/pokemon-type";
import { isTerrainPassable } from "../enums/terrain-type";
import type { Grid } from "../grid/Grid";
import type { BattleEvent } from "../types/battle-event";
import type { BattleState } from "../types/battle-state";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import { manhattanDistance } from "./aura-system";
import { isEffectivelyFlying } from "./effective-flying";
import { getEntryHazardsAt } from "./entry-hazard-system";
import { isTerrainImmune } from "./terrain-effects";

function positionKey(position: Position): string {
  return `${position.x},${position.y}`;
}

/**
 * Spawn tiles of the mon's team: the union of every teammate's `spawnPosition` (the mon itself
 * included; a KO'd teammate's tile still counts — `isSafeDestination` rejects occupied tiles
 * anyway), deduplicated. Empty when no spawn tile was ever stamped.
 */
function teamSpawnTiles(state: BattleState, teleportee: PokemonInstance): Position[] {
  const seen = new Set<string>();
  const tiles: Position[] = [];
  for (const mon of state.pokemon.values()) {
    if (mon.playerId !== teleportee.playerId || mon.spawnPosition === undefined) {
      continue;
    }
    const key = positionKey(mon.spawnPosition);
    if (!seen.has(key)) {
      seen.add(key);
      tiles.push(mon.spawnPosition);
    }
  }
  return tiles;
}

/**
 * A spawn tile is a valid eject destination when it is on the board, landable for the teleportee
 * (passable terrain, or a non-passable terrain it is immune to), free of any other occupant, and
 * carries no entry hazard — so the eject never drops a mon onto lethal terrain or a trap.
 */
function isSafeDestination(
  state: BattleState,
  grid: Grid,
  position: Position,
  teleportee: PokemonInstance,
  teleporteeTypes: PokemonType[],
): boolean {
  if (!grid.isInBounds(position)) {
    return false;
  }
  const tile = grid.getTile(position);
  if (tile === null) {
    return false;
  }
  const isFlying = isEffectivelyFlying(teleportee, teleporteeTypes);
  if (
    !isTerrainPassable(tile.terrain) &&
    !isTerrainImmune(tile.terrain, teleporteeTypes, isFlying)
  ) {
    return false;
  }
  const occupant = grid.getOccupant(position);
  if (occupant !== null && occupant !== teleportee.id) {
    return false;
  }
  return getEntryHazardsAt(state, position).length === 0;
}

/**
 * Teleport `teleportee` back to a safe tile of its spawn zone, away from `threat` (the eject items:
 * Bouton Fuite sends the holder home, Carton Rouge sends the attacker home). Prefers the mon's own
 * spawn tile; otherwise the safe team-spawn tile farthest from the threat (deterministic tie-break).
 * Mutates the grid and the mon's position, and returns the `Teleported` event — or `null` when no
 * safe tile other than the current one exists (the caller then leaves the item unconsumed).
 */
export function ejectToSpawn(
  state: BattleState,
  grid: Grid,
  teleportee: PokemonInstance,
  teleporteeTypes: PokemonType[],
  threat: Position,
): BattleEvent | null {
  const currentKey = positionKey(teleportee.position);
  const safeTiles = teamSpawnTiles(state, teleportee).filter(
    (tile) =>
      positionKey(tile) !== currentKey &&
      isSafeDestination(state, grid, tile, teleportee, teleporteeTypes),
  );
  if (safeTiles.length === 0) {
    return null;
  }

  const own = teleportee.spawnPosition;
  const ownIsSafe =
    own !== undefined && safeTiles.some((tile) => positionKey(tile) === positionKey(own));
  // Prefer the mon's own spawn tile; otherwise the safe team-spawn tile farthest from the threat
  // (deterministic tie-break by x then y). `reduce` keeps `destination` non-undefined under
  // noUncheckedIndexedAccess since `safeTiles` is non-empty here.
  const destination: Position =
    ownIsSafe && own !== undefined
      ? own
      : safeTiles.reduce((best, tile) => {
          const distanceDelta = manhattanDistance(tile, threat) - manhattanDistance(best, threat);
          if (distanceDelta > 0) {
            return tile;
          }
          if (distanceDelta < 0) {
            return best;
          }
          if (tile.x !== best.x) {
            return tile.x < best.x ? tile : best;
          }
          return tile.y < best.y ? tile : best;
        });

  const origin = { ...teleportee.position };
  grid.setOccupant(origin, null);
  grid.setOccupant(destination, teleportee.id);
  teleportee.position = { ...destination };
  teleportee.movedThisTurn = true;

  return {
    type: BattleEventType.Teleported,
    pokemonId: teleportee.id,
    fromPosition: origin,
    toPosition: { ...destination },
    targetTile: { ...destination },
  };
}
