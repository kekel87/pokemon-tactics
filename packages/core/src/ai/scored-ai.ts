import type { BattleEngine } from "../battle/BattleEngine";
import type { Action } from "../types/action";
import type { AiProfile } from "../types/ai-profile";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { RandomFn } from "../utils/prng";
import { scoreAction } from "./action-scorer";

export function pickScoredAction(
  legalActions: Action[],
  state: BattleState,
  moveRegistry: Map<string, MoveDefinition>,
  engine: BattleEngine,
  profile: AiProfile,
  random: RandomFn,
): Action {
  const first = legalActions[0];
  if (!first) {
    throw new Error("No legal actions available");
  }

  if (legalActions.length === 1) {
    return first;
  }

  const scored = legalActions
    .map((action) => ({
      action,
      score: scoreAction(action, state, moveRegistry, engine, profile),
    }))
    .sort((a, b) => b.score - a.score);

  const viable = scored.filter((entry) => entry.score >= 0);
  const topN = (viable.length > 0 ? viable : scored).slice(0, Math.max(1, profile.topN));

  if (profile.randomWeight <= 0) {
    return topN[0]?.action ?? first;
  }

  if (random() < profile.randomWeight) {
    const index = Math.floor(random() * topN.length);
    return topN[index]?.action ?? first;
  }

  return topN[0]?.action ?? first;
}
