import type { TiledLayer, TiledMap, TiledTile } from "../tiled-types";

interface FixtureOptions {
  width: number;
  height: number;
  terrainLayers: { name: string; offsety?: number; data: number[] }[];
  tileDefinitions: TiledTile[];
}

export function buildFixture(options: FixtureOptions): TiledMap {
  const { width, height, terrainLayers, tileDefinitions } = options;
  const cellCount = width * height;

  const layers: TiledLayer[] = [];

  for (const layer of terrainLayers) {
    if (layer.data.length !== cellCount) {
      throw new Error(
        `Layer "${layer.name}" has ${layer.data.length} cells, expected ${cellCount}`,
      );
    }
    layers.push({
      name: layer.name,
      type: "tilelayer",
      width,
      height,
      data: layer.data,
      visible: true,
      ...(layer.offsety === undefined ? {} : { offsety: layer.offsety }),
    });
  }

  layers.push({
    name: "decorations",
    type: "tilelayer",
    width,
    height,
    data: new Array(cellCount).fill(0),
    visible: true,
  });

  layers.push({
    name: "spawns",
    type: "objectgroup",
    visible: true,
    objects: [
      {
        id: 1,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        name: "spawn-1",
        type: "",
        properties: [
          { name: "teamIndex", type: "int", value: 0 },
          { name: "formatTeamCount", type: "int", value: 2 },
        ],
      },
      {
        id: 2,
        x: width * 16,
        y: height * 8,
        width: 0,
        height: 0,
        name: "spawn-2",
        type: "",
        properties: [
          { name: "teamIndex", type: "int", value: 1 },
          { name: "formatTeamCount", type: "int", value: 2 },
        ],
      },
    ],
  });

  return {
    width,
    height,
    tilewidth: 32,
    tileheight: 16,
    orientation: "isometric",
    layers,
    tilesets: [
      {
        firstgid: 1,
        name: "test-tileset",
        tilewidth: 32,
        tileheight: 32,
        tilecount: 528,
        columns: 22,
        tiles: tileDefinitions,
      },
    ],
    properties: [
      { name: "id", type: "string", value: "fixture-map" },
      { name: "name", type: "string", value: "Fixture Map" },
    ],
  };
}

export const GRASS_BASE: TiledTile = {
  id: 22,
  properties: [
    { name: "height", type: "float", value: 1 },
    { name: "terrain", type: "string", value: "normal" },
  ],
};

export const GRASS_HALF: TiledTile = {
  id: 23,
  properties: [
    { name: "height", type: "float", value: 0.5 },
    { name: "terrain", type: "string", value: "normal" },
  ],
};

export const GRASS_SLOPE_EAST: TiledTile = {
  id: 24,
  properties: [
    { name: "height", type: "float", value: 0.5 },
    { name: "terrain", type: "string", value: "normal" },
    { name: "slope", type: "string", value: "east" },
  ],
};

export const ROCK_BASE: TiledTile = {
  id: 114,
  properties: [
    { name: "height", type: "float", value: 1 },
    { name: "terrain", type: "string", value: "normal" },
  ],
};

export const ROCK_HALF: TiledTile = {
  id: 115,
  properties: [
    { name: "height", type: "float", value: 0.5 },
    { name: "terrain", type: "string", value: "normal" },
  ],
};

export const WATER_BASE: TiledTile = {
  id: 198,
  properties: [
    { name: "height", type: "float", value: 1 },
    { name: "terrain", type: "string", value: "water" },
  ],
};

/** Grass base, GID = tile.id + firstgid (1) */
export const GRASS_BASE_GID = 23;
export const GRASS_HALF_GID = 24;
export const GRASS_SLOPE_EAST_GID = 25;
export const ROCK_BASE_GID = 115;
export const ROCK_HALF_GID = 116;
export const WATER_BASE_GID = 199;

export const ALL_TILE_DEFINITIONS: TiledTile[] = [
  GRASS_BASE,
  GRASS_HALF,
  GRASS_SLOPE_EAST,
  ROCK_BASE,
  ROCK_HALF,
  WATER_BASE,
];
