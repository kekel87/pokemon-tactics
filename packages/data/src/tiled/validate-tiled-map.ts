import { isTerrainPassable, type MapDefinition, type Position } from "@pokemon-tactic/core";

export const REQUIRED_TEAM_COUNTS = [2, 3, 4, 6, 12] as const;

export interface TiledMapValidation {
  readonly valid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
}

export interface ValidateTiledMapOptions {
  readonly requireAllFormats?: boolean;
}

function posKey(position: Position): string {
  return `${position.x},${position.y}`;
}

function isSpawnableTerrainAt(map: MapDefinition, position: Position): boolean {
  const row = map.tiles[position.y];
  const tile = row?.[position.x];
  if (!tile) {
    return false;
  }
  return isTerrainPassable(tile.terrain);
}

function checkSpawnConnectivity(
  map: MapDefinition,
  spawnsA: Position[],
  spawnsB: Position[],
): boolean {
  if (spawnsA.length === 0 || spawnsB.length === 0) {
    return false;
  }

  const targetKeys = new Set(spawnsB.map(posKey));
  const visited = new Set<string>();
  const queue: Position[] = [...spawnsA];

  for (const start of queue) {
    visited.add(posKey(start));
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    if (targetKeys.has(posKey(current))) {
      return true;
    }

    const neighbors: Position[] = [
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
    ];

    for (const neighbor of neighbors) {
      const key = posKey(neighbor);
      if (visited.has(key)) {
        continue;
      }
      if (neighbor.x < 0 || neighbor.x >= map.width || neighbor.y < 0 || neighbor.y >= map.height) {
        continue;
      }
      const row = map.tiles[neighbor.y];
      const tile = row?.[neighbor.x];
      if (!tile || !isTerrainPassable(tile.terrain)) {
        continue;
      }
      visited.add(key);
      queue.push(neighbor);
    }
  }

  return false;
}

export function validateTiledMap(
  map: MapDefinition,
  options: ValidateTiledMapOptions = {},
): TiledMapValidation {
  const { requireAllFormats = true } = options;
  const errors: string[] = [];
  const warnings: string[] = [];

  const declaredTeamCounts = new Set(map.formats.map((f) => f.teamCount));
  if (requireAllFormats) {
    for (const required of REQUIRED_TEAM_COUNTS) {
      if (!declaredTeamCounts.has(required)) {
        errors.push(
          `Map does not declare required format teamCount=${required}. Required set: ${REQUIRED_TEAM_COUNTS.join(", ")}`,
        );
      }
    }
  }
  for (const declared of declaredTeamCounts) {
    if (!REQUIRED_TEAM_COUNTS.includes(declared as (typeof REQUIRED_TEAM_COUNTS)[number])) {
      warnings.push(
        `Map declares unsupported format teamCount=${declared} (UI only proposes ${REQUIRED_TEAM_COUNTS.join(", ")})`,
      );
    }
  }

  for (const format of map.formats) {
    for (let zoneIndex = 0; zoneIndex < format.spawnZones.length; zoneIndex++) {
      const zone = format.spawnZones[zoneIndex];
      if (!zone) {
        continue;
      }

      for (const position of zone.positions) {
        if (!isSpawnableTerrainAt(map, position)) {
          const row = map.tiles[position.y];
          const tile = row?.[position.x];
          const terrain = tile?.terrain ?? "out-of-bounds";
          errors.push(
            `Format ${format.teamCount}p zone ${zoneIndex}: spawn at (${position.x}, ${position.y}) is on impassable terrain "${terrain}"`,
          );
        }
      }

      if (zone.positions.length < format.maxPokemonPerTeam) {
        errors.push(
          `Format ${format.teamCount}p zone ${zoneIndex}: has ${zone.positions.length} spawn positions, needs at least ${format.maxPokemonPerTeam}`,
        );
      }
    }

    for (let i = 0; i < format.spawnZones.length; i++) {
      for (let j = i + 1; j < format.spawnZones.length; j++) {
        const zoneA = format.spawnZones[i];
        const zoneB = format.spawnZones[j];
        if (!zoneA || !zoneB) {
          continue;
        }
        if (!checkSpawnConnectivity(map, zoneA.positions, zoneB.positions)) {
          errors.push(
            `Format ${format.teamCount}p: no passable path between zone ${i} and zone ${j}`,
          );
        }
      }
    }
  }

  for (let y = 0; y < map.height; y++) {
    const row = map.tiles[y];
    if (!row) {
      continue;
    }
    for (let x = 0; x < map.width; x++) {
      const tile = row[x];
      if (!tile) {
        continue;
      }
      const neighbors: Position[] = [
        { x: x + 1, y },
        { x, y: y + 1 },
      ];
      for (const neighbor of neighbors) {
        const neighborRow = map.tiles[neighbor.y];
        const neighborTile = neighborRow?.[neighbor.x];
        if (neighborTile) {
          const diff = Math.abs(tile.height - neighborTile.height);
          if (diff > 2) {
            warnings.push(
              `Height jump of ${diff} between (${x}, ${y}) height=${tile.height} and (${neighbor.x}, ${neighbor.y}) height=${neighborTile.height}`,
            );
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
