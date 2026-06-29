import type { BattleEngine } from "../battle/BattleEngine";
import { ActionKind } from "../enums/action-kind";
import { CallMoveSourceKind } from "../enums/call-move-source-kind";
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
    return enrichHitAndRunRetreat(
      enrichCalledMove(first, state, moveRegistry, engine, random),
      state,
      moveRegistry,
      engine,
      random,
    );
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

  return enrichHitAndRunRetreat(
    enrichCalledMove(picked, state, moveRegistry, engine, random),
    state,
    moveRegistry,
    engine,
    random,
  );
}

/**
 * Move-copy (plan 144): resolve a call-move the AI committed to (Métronome / Blabla Dodo / Mimique /
 * Photocopie) and re-target it. `prepareCalledMove` rolls / reads the called move and pins it on the
 * caster (so the subsequent submitAction swaps to it); the action's target is then re-pointed at the
 * called move's best legal tile — an enemy when the rolled move can reach one, otherwise its first
 * valid tile. Target-last (Mimique) anchors on the nearest enemy that has acted. A failed resolution
 * leaves the action as-is (it fizzles at execution — turn still spent, no crash).
 */
function enrichCalledMove(
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
  if (!move || move.callMove === undefined) {
    return action;
  }
  const caster = state.pokemon.get(action.pokemonId);
  if (!caster) {
    return action;
  }

  let selectedTargetId: string | undefined;
  if (move.callMove === CallMoveSourceKind.TargetLast) {
    selectedTargetId = nearestEnemyWithLastMove(caster, state);
    if (selectedTargetId === undefined) {
      return action;
    }
  }

  const prepared = engine.prepareCalledMove(caster.id, action.moveId, selectedTargetId);
  if ("failed" in prepared) {
    return action;
  }

  const candidates = engine
    .getLegalActions(caster.playerId)
    .filter(
      (candidate): candidate is Extract<Action, { kind: typeof ActionKind.UseMove }> =>
        candidate.kind === ActionKind.UseMove && candidate.moveId === action.moveId,
    );
  if (candidates.length === 0) {
    return action;
  }
  const enemyTargeted = candidates.find((candidate) => {
    const occupantId = engine.getGrid().getOccupant(candidate.targetPosition);
    const occupant = occupantId === null ? undefined : state.pokemon.get(occupantId);
    return (
      occupant !== undefined && occupant.playerId !== caster.playerId && occupant.currentHp > 0
    );
  });
  const chosen =
    enemyTargeted ?? candidates[Math.floor(random() * candidates.length)] ?? candidates[0];
  return chosen ?? action;
}

/** Nearest living enemy that has used a move (drives Mimique's target-last resolution). */
function nearestEnemyWithLastMove(caster: PokemonInstance, state: BattleState): string | undefined {
  let bestId: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const pokemon of state.pokemon.values()) {
    if (
      pokemon.playerId === caster.playerId ||
      pokemon.currentHp <= 0 ||
      pokemon.lastUsedMoveId === undefined
    ) {
      continue;
    }
    const distance =
      Math.abs(pokemon.position.x - caster.position.x) +
      Math.abs(pokemon.position.y - caster.position.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = pokemon.id;
    }
  }
  return bestId;
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
