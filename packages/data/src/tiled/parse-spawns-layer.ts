import type { MapFormat, Position } from "@pokemon-tactic/core";
import type { TiledLayer, TiledObject, TiledPoint } from "./tiled-types";
import { findProperty } from "./tiled-utils";

export const SPAWN_LAYER_TO_TEAM_COUNT: Readonly<Record<string, number>> = {
  spawns_1v1: 2,
  spawns_3p: 3,
  spawns_4p: 4,
  spawns_6p: 6,
  spawns_12p: 12,
};

export const SPAWN_LAYER_NAMES: readonly string[] = Object.keys(SPAWN_LAYER_TO_TEAM_COUNT);

export function isSpawnLayerName(name: string): boolean {
  return name in SPAWN_LAYER_TO_TEAM_COUNT;
}

interface ParsedSpawn {
  readonly position: Position;
  readonly teamIndex: number;
}

const MAX_POKEMON_PER_BATTLE = 12;

function stepX(tileWidth: number, orientation: string): number {
  return orientation === "isometric" ? tileWidth / 2 : tileWidth;
}

function clampToMap(gridX: number, gridY: number, mapWidth: number, mapHeight: number): Position {
  return {
    x: Math.max(0, Math.min(mapWidth - 1, gridX)),
    y: Math.max(0, Math.min(mapHeight - 1, gridY)),
  };
}

function pointInPolygon(testX: number, testY: number, polygon: readonly TiledPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];
    if (!pi || !pj) {
      continue;
    }
    const xi = pi.x;
    const yi = pi.y;
    const xj = pj.x;
    const yj = pj.y;
    const intersect =
      yi > testY !== yj > testY && testX < ((xj - xi) * (testY - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

function enumerateCellsForObject(
  object: TiledObject,
  tileWidth: number,
  tileHeight: number,
  mapWidth: number,
  mapHeight: number,
  orientation: string,
): Position[] {
  const xStep = stepX(tileWidth, orientation);
  const yStep = tileHeight;

  if (object.polygon && object.polygon.length >= 3) {
    const absolute = object.polygon.map((p) => ({ x: object.x + p.x, y: object.y + p.y }));
    const xs = absolute.map((p) => p.x);
    const ys = absolute.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const minGx = Math.floor(minX / xStep);
    const maxGx = Math.floor(maxX / xStep);
    const minGy = Math.floor(minY / yStep);
    const maxGy = Math.floor(maxY / yStep);

    const cells: Position[] = [];
    const seen = new Set<string>();
    for (let gy = minGy; gy <= maxGy; gy++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const centerPx = gx * xStep + xStep / 2;
        const centerPy = gy * yStep + yStep / 2;
        if (pointInPolygon(centerPx, centerPy, absolute)) {
          const cell = clampToMap(gx, gy, mapWidth, mapHeight);
          const key = `${cell.x},${cell.y}`;
          if (!seen.has(key)) {
            seen.add(key);
            cells.push(cell);
          }
        }
      }
    }
    return cells;
  }

  if (object.width > 0 && object.height > 0) {
    const minGx = Math.floor(object.x / xStep);
    const maxGx = Math.floor((object.x + object.width - 1) / xStep);
    const minGy = Math.floor(object.y / yStep);
    const maxGy = Math.floor((object.y + object.height - 1) / yStep);

    const cells: Position[] = [];
    const seen = new Set<string>();
    for (let gy = minGy; gy <= maxGy; gy++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const cell = clampToMap(gx, gy, mapWidth, mapHeight);
        const key = `${cell.x},${cell.y}`;
        if (!seen.has(key)) {
          seen.add(key);
          cells.push(cell);
        }
      }
    }
    return cells;
  }

  return [
    clampToMap(Math.floor(object.x / xStep), Math.floor(object.y / yStep), mapWidth, mapHeight),
  ];
}

const SPAWN_TEAM_CLASS_PATTERN = /^spawn_team_(\d+)$/;

function resolveTeamIndex(object: TiledObject): number | undefined {
  const teamIndexProp = findProperty(object.properties, "teamIndex");
  if (teamIndexProp !== undefined) {
    return Number(teamIndexProp.value);
  }
  const match = SPAWN_TEAM_CLASS_PATTERN.exec(object.type);
  if (match) {
    return Number(match[1]);
  }
  return undefined;
}

function parseObjectsInLayer(
  layer: TiledLayer,
  tileWidth: number,
  tileHeight: number,
  mapWidth: number,
  mapHeight: number,
  orientation: string,
): ParsedSpawn[] {
  if (layer.type !== "objectgroup") {
    throw new Error(`Expected objectgroup, got "${layer.type}" for layer "${layer.name}"`);
  }

  const objects = layer.objects ?? [];
  const entries: ParsedSpawn[] = [];

  for (const object of objects) {
    const teamIndex = resolveTeamIndex(object);
    if (teamIndex === undefined) {
      throw new Error(
        `Spawn object at pixel (${object.x}, ${object.y}) in layer "${layer.name}" is missing "teamIndex" (either as a property or via class "spawn_team_N")`,
      );
    }
    const cells = enumerateCellsForObject(
      object,
      tileWidth,
      tileHeight,
      mapWidth,
      mapHeight,
      orientation,
    );
    for (const position of cells) {
      entries.push({ position, teamIndex });
    }
  }

  return entries;
}

function buildFormat(teamCount: number, spawns: readonly ParsedSpawn[]): MapFormat {
  const byTeamIndex = new Map<number, { positions: Position[]; seen: Set<string> }>();
  for (const spawn of spawns) {
    let bucket = byTeamIndex.get(spawn.teamIndex);
    if (!bucket) {
      bucket = { positions: [], seen: new Set<string>() };
      byTeamIndex.set(spawn.teamIndex, bucket);
    }
    const key = `${spawn.position.x},${spawn.position.y}`;
    if (!bucket.seen.has(key)) {
      bucket.seen.add(key);
      bucket.positions.push(spawn.position);
    }
  }

  const spawnZones = [...byTeamIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, bucket]) => ({ positions: bucket.positions }));

  const maxPositions = Math.max(...spawnZones.map((z) => z.positions.length));
  const gameplayCap = Math.floor(MAX_POKEMON_PER_BATTLE / teamCount);
  const maxPokemonPerTeam = Math.min(maxPositions, gameplayCap);

  return { teamCount, maxPokemonPerTeam, spawnZones };
}

export function parseSpawnsLayers(
  layers: readonly TiledLayer[],
  tileWidth: number,
  tileHeight: number,
  mapWidth: number,
  mapHeight: number,
  orientation: string,
): MapFormat[] {
  const formats: MapFormat[] = [];

  for (const [layerName, teamCount] of Object.entries(SPAWN_LAYER_TO_TEAM_COUNT)) {
    const layer = layers.find((l) => l.name === layerName);
    if (!layer) {
      continue;
    }
    const spawns = parseObjectsInLayer(
      layer,
      tileWidth,
      tileHeight,
      mapWidth,
      mapHeight,
      orientation,
    );
    if (spawns.length === 0) {
      continue;
    }
    formats.push(buildFormat(teamCount, spawns));
  }

  return formats;
}

export function parseLegacySpawnsLayer(
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

  const byFormat = new Map<number, ParsedSpawn[]>();

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

    const teamIndex = Number(teamIndexProp.value);
    const teamCount = Number(formatProp.value);
    const cells = enumerateCellsForObject(
      object,
      tileWidth,
      tileHeight,
      mapWidth,
      mapHeight,
      orientation,
    );

    let bucket = byFormat.get(teamCount);
    if (!bucket) {
      bucket = [];
      byFormat.set(teamCount, bucket);
    }
    for (const position of cells) {
      bucket.push({ position, teamIndex });
    }
  }

  const formats: MapFormat[] = [];
  for (const [teamCount, spawns] of [...byFormat.entries()].sort(([a], [b]) => a - b)) {
    formats.push(buildFormat(teamCount, spawns));
  }
  return formats;
}
