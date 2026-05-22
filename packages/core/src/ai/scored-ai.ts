import type { BattleEngine } from "../battle/BattleEngine";
import { ActionKind } from "../enums/action-kind";
import { TargetingKind } from "../enums/targeting-kind";
import type { Action } from "../types/action";
import type { AiProfile } from "../types/ai-profile";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { RandomFn } from "../utils/prng";
import { scoreAction } from "./action-scorer";
import { pickAiHitAndRunRetreat } from "./pick-hit-and-run-retreat";

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
    return enrichHitAndRunRetreat(first, state, moveRegistry, engine, random);
  }

  const scored = legalActions
    .map((action) => ({
      action,
      score: scoreAction(action, state, moveRegistry, engine, profile),
    }))
    .sort((a, b) => b.score - a.score);

  const viable = scored.filter((entry) => entry.score >= 0);
  const topN = (viable.length > 0 ? viable : scored).slice(0, Math.max(1, profile.topN));

  let picked: Action;
  if (profile.randomWeight <= 0) {
    picked = topN[0]?.action ?? first;
  } else if (random() < profile.randomWeight) {
    const index = Math.floor(random() * topN.length);
    picked = topN[index]?.action ?? first;
  } else {
    picked = topN[0]?.action ?? first;
  }

  return enrichHitAndRunRetreat(picked, state, moveRegistry, engine, random);
}

function enrichHitAndRunRetreat(
  action: Action,
  state: BattleState,
  moveRegistry: Map<string, MoveDefinition>,
  engine: BattleEngine,
  random: RandomFn,
): Action {
  if (action.kind !== ActionKind.UseMove) {
    return action;
  }
  const move = moveRegistry.get(action.moveId);
  if (!move || move.targeting.kind !== TargetingKind.HitAndRun) {
    return action;
  }
  const caster = state.pokemon.get(action.pokemonId);
  if (!caster) {
    return action;
  }
  const enemies: PokemonInstance[] = [];
  for (const pokemon of state.pokemon.values()) {
    if (pokemon.playerId !== caster.playerId && pokemon.currentHp > 0) {
      enemies.push(pokemon);
    }
  }
  const retreatPosition = pickAiHitAndRunRetreat(
    caster.position,
    move.targeting.retreatRange,
    engine.getGrid(),
    enemies,
    random,
  );
  if (retreatPosition === null) {
    return action;
  }
  return { ...action, retreatPosition };
}
