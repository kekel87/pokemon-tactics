/**
 * Engine-agnostic field-terrain ("Champs") perimeter logic (plan 125 — hoisted
 * from render-babylon). Given the tiles of a zone, returns which of each tile's
 * four grid edges lie on the zone border (a neighbour absent from the set). The
 * renderer turns each (tile, side) into its own world-space line segment; the
 * set arithmetic is the same for every engine.
 */

/** Which grid edge of a tile: the neighbour on that axis side is outside the zone. */
export type FieldTerrainEdgeSide = "xPlus" | "xMinus" | "yPlus" | "yMinus";

export interface FieldTerrainBorderEdge {
  readonly x: number;
  readonly y: number;
  readonly side: FieldTerrainEdgeSide;
}

interface GridTile {
  readonly x: number;
  readonly y: number;
}

/**
 * The two endpoints of a border edge, as offsets from the tile's top-face centre
 * (in the centred terrain frame: ±0.5 on each world axis). The renderer adds these
 * to its `tileTopCenter` to get the world-space line segment. Shared by the range
 * outline (tile-highlights) and the field-terrain perimeter so the side→segment
 * mapping lives once.
 */
export interface FieldTerrainBorderSegmentOffset {
  readonly ax: number;
  readonly az: number;
  readonly bx: number;
  readonly bz: number;
}

/** Endpoint offsets of a border edge from the tile top centre (gridX→Z, gridY→X). */
export function fieldTerrainBorderSegment(
  side: FieldTerrainEdgeSide,
): FieldTerrainBorderSegmentOffset {
  switch (side) {
    case "xPlus":
      return { ax: -0.5, az: 0.5, bx: 0.5, bz: 0.5 };
    case "xMinus":
      return { ax: -0.5, az: -0.5, bx: 0.5, bz: -0.5 };
    case "yPlus":
      return { ax: 0.5, az: -0.5, bx: 0.5, bz: 0.5 };
    case "yMinus":
      return { ax: -0.5, az: -0.5, bx: -0.5, bz: 0.5 };
  }
}

/** Border edges of a zone: per tile, each side whose neighbour is not in the set. */
export function fieldTerrainBorderEdges(
  tiles: readonly GridTile[],
): readonly FieldTerrainBorderEdge[] {
  const inSet = new Set(tiles.map((tile) => `${tile.x},${tile.y}`));
  const edges: FieldTerrainBorderEdge[] = [];
  for (const { x, y } of tiles) {
    if (!inSet.has(`${x + 1},${y}`)) {
      edges.push({ x, y, side: "xPlus" });
    }
    if (!inSet.has(`${x - 1},${y}`)) {
      edges.push({ x, y, side: "xMinus" });
    }
    if (!inSet.has(`${x},${y + 1}`)) {
      edges.push({ x, y, side: "yPlus" });
    }
    if (!inSet.has(`${x},${y - 1}`)) {
      edges.push({ x, y, side: "yMinus" });
    }
  }
  return edges;
}
