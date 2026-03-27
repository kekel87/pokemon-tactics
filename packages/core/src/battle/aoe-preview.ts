import { Direction } from "../enums/direction";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import type { TargetingPattern } from "../types/targeting-pattern";
import type { TraversalContext } from "../types/traversal-context";
import { resolveTargeting } from "../grid/targeting";
import type { Grid } from "../grid/Grid";

export function getAoePreview(
  targetingPattern: TargetingPattern,
  caster: PokemonInstance,
  targetPosition: Position,
  grid: Grid,
  traversalContext?: TraversalContext,
): Position[] {
  const traversal = traversalContext ?? { allyIds: new Set<string>(), canTraverseEnemies: false };
  return resolveTargeting(targetingPattern, caster, targetPosition, grid, traversal);
}
