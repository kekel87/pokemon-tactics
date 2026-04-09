import type { MapFormat, Position } from "@pokemon-tactic/core";
import type { TiledLayer } from "./tiled-types";
import { findProperty } from "./tiled-utils";

interface SpawnEntry {
  readonly position: Position;
  readonly teamIndex: number;
  readonly formatTeamCount: number;
}

export function parseSpawnsLayer(
  layer: TiledLayer,
  tileWidth: number,
  tileHeight: number,
  mapWidth: number,
  mapHeight: number,
  orientation: string,
): MapFormat[] {
  if (layer.type !== "objectgroup") {
    throw new Error(`Expected objectgroup, got "${layer.type}" for layer "${layer.name}"`);
  }

  if (!layer.objects || layer.objects.length === 0) {
    throw new Error(`Layer "${layer.name}" has no spawn objects`);
  }

  const entries: SpawnEntry[] = [];

  for (const object of layer.objects) {
    const teamIndexProp = findProperty(object.properties, "teamIndex");
    const formatProp = findProperty(object.properties, "formatTeamCount");

    if (teamIndexProp === undefined) {
      throw new Error(
        `Spawn object at pixel (${object.x}, ${object.y}) is missing "teamIndex" property`,
      );
    }
    if (formatProp === undefined) {
      throw new Error(
        `Spawn object at pixel (${object.x}, ${object.y}) is missing "formatTeamCount" property`,
      );
    }

    let gridX: number;
    let gridY: number;
    if (orientation === "isometric") {
      const halfTileWidth = tileWidth / 2;
      gridX = Math.floor(object.x / halfTileWidth);
      gridY = Math.floor(object.y / tileHeight);
    } else {
      gridX = Math.floor(object.x / tileWidth);
      gridY = Math.floor(object.y / tileHeight);
    }
    gridX = Math.max(0, Math.min(mapWidth - 1, gridX));
    gridY = Math.max(0, Math.min(mapHeight - 1, gridY));

    entries.push({
      position: { x: gridX, y: gridY },
      teamIndex: Number(teamIndexProp.value),
      formatTeamCount: Number(formatProp.value),
    });
  }

  const byFormat = new Map<number, Map<number, Position[]>>();

  for (const entry of entries) {
    let formatMap = byFormat.get(entry.formatTeamCount);
    if (!formatMap) {
      formatMap = new Map();
      byFormat.set(entry.formatTeamCount, formatMap);
    }
    let positions = formatMap.get(entry.teamIndex);
    if (!positions) {
      positions = [];
      formatMap.set(entry.teamIndex, positions);
    }
    positions.push(entry.position);
  }

  const formats: MapFormat[] = [];
  const MAX_POKEMON_PER_BATTLE = 12;

  for (const [teamCount, teamMap] of [...byFormat.entries()].sort(([a], [b]) => a - b)) {
    const spawnZones = [...teamMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, positions]) => ({ positions }));

    const maxPositions = Math.max(...spawnZones.map((z) => z.positions.length));
    const gameplayCap = Math.floor(MAX_POKEMON_PER_BATTLE / teamCount);
    const maxPokemonPerTeam = Math.min(maxPositions, gameplayCap);

    formats.push({
      teamCount,
      maxPokemonPerTeam,
      spawnZones,
    });
  }

  return formats;
}
