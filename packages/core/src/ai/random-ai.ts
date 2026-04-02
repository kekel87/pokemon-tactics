import type { Action } from "../types/action";
import type { RandomFn } from "../utils/prng";

export function pickRandomAction(legalActions: Action[], random: RandomFn): Action {
  const first = legalActions[0];
  if (!first) {
    throw new Error("No legal actions available");
  }
  const index = Math.floor(random() * legalActions.length);
  return legalActions[index] ?? first;
}
