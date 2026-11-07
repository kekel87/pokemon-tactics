import type { BattleState } from "../types/battle-state";
import type { Position } from "../types/position";

/** Enumerate the in-bounds Manhattan-diamond (radius r) tiles centered on `anchor`. */
export function enumerateZoneTiles(
  state: BattleState,
  anchor: Position,
  radius: number,
): Position[] {
  const height = state.grid.length;
  const width = state.grid[0]?.length ?? 0;
  const tiles: Position[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    const spread = radius - Math.abs(dy);
    for (let dx = -spread; dx <= spread; dx++) {
      const x = anchor.x + dx;
      const y = anchor.y + dy;
      if (x >= 0 && x < width && y >= 0 && y < height) {
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
}
