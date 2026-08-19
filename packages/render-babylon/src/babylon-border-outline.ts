import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { fieldTerrainBorderEdges, fieldTerrainBorderSegment } from "@pokemon-tactic/view-core";

/** World-space top-face centre of a tile, in the centred terrain frame. */
export interface TileTop {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * World-space line segments outlining a set of tiles — the single geometry path behind
 * every stair-stepped contour in the scene (range outline, Champs perimeter, aura rings).
 *
 * The set arithmetic lives in `view-core` (`fieldTerrainBorderEdges` picks the sides whose
 * neighbour is absent, `fieldTerrainBorderSegment` maps a side to its ±0.5 endpoints); this
 * only lifts them into world space. Each segment rides its OWN tile's top, so a contour
 * follows the relief instead of floating at one height.
 *
 * `inset` pulls the stroke toward the tile centre by that much, so a thick stroke lies
 * fully inside its tile rather than clipping into a taller neighbour's wall. It applies to
 * whichever axis is constant along the segment — the other axis spans the tile.
 */
export function borderOutlineSegments(
  tiles: readonly { readonly x: number; readonly y: number }[],
  topAt: (x: number, y: number) => TileTop,
  lift: number,
  inset = 0,
): Vector3[][] {
  const segments: Vector3[][] = [];
  for (const edge of fieldTerrainBorderEdges(tiles)) {
    const top = topAt(edge.x, edge.y);
    const lineY = top.y + lift;
    const offset = fieldTerrainBorderSegment(edge.side);
    // The constant axis carries the inset (pulled toward 0, i.e. toward the tile centre);
    // the spanning axis keeps its full ±0.5 reach so consecutive segments still meet.
    const insetX = offset.ax === offset.bx ? Math.sign(offset.ax) * inset : 0;
    const insetZ = offset.az === offset.bz ? Math.sign(offset.az) * inset : 0;
    segments.push([
      new Vector3(top.x + offset.ax - insetX, lineY, top.z + offset.az - insetZ),
      new Vector3(top.x + offset.bx - insetX, lineY, top.z + offset.bz - insetZ),
    ]);
  }
  return segments;
}
