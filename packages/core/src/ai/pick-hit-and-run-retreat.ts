import type { Grid } from "../grid/Grid";
import { enumerateHitAndRunRetreatTiles } from "../grid/validate-hit-and-run-retreat";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import type { RangeConfig } from "../types/range-config";
import { manhattanDistance } from "../utils/manhattan-distance";
import type { RandomFn } from "../utils/prng";

export function pickAiHitAndRunRetreat(
  casterPosition: Position,
  retreatRange: RangeConfig,
  grid: Grid,
  enemies: readonly PokemonInstance[],
  random: RandomFn,
): Position | null {
  const candidates = enumerateHitAndRunRetreatTiles(casterPosition, retreatRange, grid);
  if (candidates.length === 0) {
    return null;
  }
  if (enemies.length === 0) {
    return candidates[Math.floor(random() * candidates.length)] ?? null;
  }

  let bestScore = Number.NEGATIVE_INFINITY;
  const best: Position[] = [];
  for (const candidate of candidates) {
    let nearest = Number.POSITIVE_INFINITY;
    for (const enemy of enemies) {
      const distance = manhattanDistance(candidate, enemy.position);
      if (distance < nearest) {
        nearest = distance;
      }
    }
    if (nearest > bestScore) {
      bestScore = nearest;
      best.length = 0;
      best.push(candidate);
    } else if (nearest === bestScore) {
      best.push(candidate);
    }
  }

  if (best.length === 0) {
    return null;
  }
  return best[Math.floor(random() * best.length)] ?? null;
}
