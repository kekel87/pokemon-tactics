import type { MapFormat } from "./map-format";
import type { TileState } from "./tile-state";

export interface MapDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: TileState[][];
  formats: MapFormat[];
}
