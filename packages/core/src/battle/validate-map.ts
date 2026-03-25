import type { MapDefinition } from "../types/map-definition";
import type { ValidationResult } from "./validate";

export function validateMapDefinition(map: MapDefinition): ValidationResult {
  const errors: string[] = [];

  if (map.width <= 0 || map.height <= 0) {
    errors.push(`Invalid map dimensions: ${map.width}x${map.height} (must be > 0)`);
  }

  if (map.tiles.length !== map.height) {
    errors.push(`Map tiles row count (${map.tiles.length}) does not match height (${map.height})`);
  }

  for (let y = 0; y < map.tiles.length; y++) {
    const row = map.tiles[y];
    if (row && row.length !== map.width) {
      errors.push(`Map tiles row ${y} has ${row.length} columns, expected ${map.width}`);
    }
  }

  if (map.formats.length === 0) {
    errors.push("Map has no formats defined");
  }

  for (const format of map.formats) {
    if (format.spawnZones.length !== format.teamCount) {
      errors.push(
        `Format ${format.teamCount}p has ${format.spawnZones.length} spawn zones, expected ${format.teamCount}`,
      );
    }

    if (format.teamCount * format.maxPokemonPerTeam > 12) {
      errors.push(
        `Format ${format.teamCount}p x ${format.maxPokemonPerTeam} = ${format.teamCount * format.maxPokemonPerTeam} Pokemon, exceeds 12 max`,
      );
    }

    const allSpawnPositionKeys = new Set<string>();

    for (let zoneIndex = 0; zoneIndex < format.spawnZones.length; zoneIndex++) {
      const zone = format.spawnZones[zoneIndex];
      if (!zone) continue;

      if (zone.positions.length < format.maxPokemonPerTeam) {
        errors.push(
          `Format ${format.teamCount}p zone ${zoneIndex} has ${zone.positions.length} positions, needs at least ${format.maxPokemonPerTeam}`,
        );
      }

      for (const position of zone.positions) {
        if (
          position.x < 0 ||
          position.x >= map.width ||
          position.y < 0 ||
          position.y >= map.height
        ) {
          errors.push(
            `Format ${format.teamCount}p zone ${zoneIndex} has out-of-bounds position (${position.x}, ${position.y})`,
          );
          continue;
        }

        const row = map.tiles[position.y];
        const tile = row?.[position.x];
        if (tile && !tile.isPassable) {
          errors.push(
            `Format ${format.teamCount}p zone ${zoneIndex} has impassable position (${position.x}, ${position.y})`,
          );
        }

        const key = `${position.x},${position.y}`;
        if (allSpawnPositionKeys.has(key)) {
          errors.push(
            `Format ${format.teamCount}p has overlapping spawn position (${position.x}, ${position.y})`,
          );
        }
        allSpawnPositionKeys.add(key);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
