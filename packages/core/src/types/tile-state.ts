import type { TerrainType } from "../enums/terrain-type";
import type { Position } from "./position";

export interface TileState {
  position: Position;
  height: number;
  terrain: TerrainType;
  occupantId: string | null;
  isPassable: boolean;
}
