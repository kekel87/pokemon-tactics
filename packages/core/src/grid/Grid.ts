import { TerrainType } from "../enums/terrain-type";
import type { Position } from "../types/position";
import type { TileState } from "../types/tile-state";
import { manhattanDistance } from "../utils/manhattan-distance";

const NEIGHBOR_OFFSETS: Position[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

export class Grid {
  readonly width: number;
  readonly height: number;
  private readonly tiles: TileState[][];

  constructor(width: number, height: number, tiles: TileState[][]) {
    this.width = width;
    this.height = height;
    this.tiles = tiles;
  }

  static createFlat(width: number, height: number): Grid {
    const tiles: TileState[][] = [];
    for (let y = 0; y < height; y++) {
      const row: TileState[] = [];
      for (let x = 0; x < width; x++) {
        row.push({
          position: { x, y },
          height: 0,
          terrain: TerrainType.Normal,
          occupantId: null,
        });
      }
      tiles.push(row);
    }
    return new Grid(width, height, tiles);
  }

  isInBounds(position: Position): boolean {
    return (
      position.x >= 0 && position.x < this.width && position.y >= 0 && position.y < this.height
    );
  }

  getTile(position: Position): TileState | null {
    if (!this.isInBounds(position)) {
      return null;
    }
    const row = this.tiles[position.y] as TileState[];
    return row[position.x] as TileState;
  }

  getNeighbors(position: Position): TileState[] {
    const neighbors: TileState[] = [];
    for (const offset of NEIGHBOR_OFFSETS) {
      const neighbor = this.getTile({ x: position.x + offset.x, y: position.y + offset.y });
      if (neighbor !== null) {
        neighbors.push(neighbor);
      }
    }
    return neighbors;
  }

  getOccupant(position: Position): string | null {
    return this.getTile(position)?.occupantId ?? null;
  }

  setOccupant(position: Position, occupantId: string | null): void {
    const tile = this.getTile(position);
    if (tile !== null) {
      tile.occupantId = occupantId;
    }
  }

  getTilesInRange(origin: Position, minRange: number, maxRange: number): Position[] {
    const result: Position[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const distance = manhattanDistance(origin, { x, y });
        if (distance >= minRange && distance <= maxRange) {
          result.push({ x, y });
        }
      }
    }
    return result;
  }

  getHeightDifference(from: Position, to: Position): number {
    const fromTile = this.getTile(from);
    const toTile = this.getTile(to);
    if (fromTile === null || toTile === null) {
      return 0;
    }
    return toTile.height - fromTile.height;
  }
}
