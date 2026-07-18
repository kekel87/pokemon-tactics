import movesReference from "../../reference/moves.json" with { type: "json" };

interface MoveRef {
  id: string;
  power?: number | null;
}

const powerById = new Map<string, number>(
  (movesReference as unknown as MoveRef[]).map((move) => [move.id, move.power ?? 0]),
);

/**
 * Highest-base-power move among the given ids — backs the Prédiction (forewarn) reveal badge (plan
 * 163). Ties resolve to the first move seen. Returns undefined for an empty list.
 */
export function strongestMoveId(moveIds: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestPower = -1;
  for (const id of moveIds) {
    const power = powerById.get(id) ?? 0;
    if (power > bestPower) {
      bestPower = power;
      best = id;
    }
  }
  return best;
}
