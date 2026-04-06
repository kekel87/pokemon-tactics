import { ActionKind } from "../enums/action-kind";
import type { Action } from "../types/action";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { Position } from "../types/position";
import { directionFromTo } from "../utils/direction";
import { manhattanDistance } from "../utils/manhattan-distance";
import type { RandomFn } from "../utils/prng";

export function pickAggressiveAction(
  legalActions: Action[],
  state: BattleState,
  moveRegistry: Map<string, MoveDefinition>,
  random: RandomFn,
): Action {
  const first = legalActions[0];
  if (!first) {
    throw new Error("No legal actions available");
  }

  const currentPokemonId = state.turnOrder[state.currentTurnIndex];
  const currentPokemon = currentPokemonId ? state.pokemon.get(currentPokemonId) : undefined;
  if (!currentPokemon) {
    return first;
  }

  const enemies = [...state.pokemon.values()].filter(
    (p) => p.playerId !== currentPokemon.playerId && p.currentHp > 0,
  );

  const useMoveActions = legalActions.filter(
    (a): a is Extract<Action, { kind: typeof ActionKind.UseMove }> => a.kind === ActionKind.UseMove,
  );

  if (useMoveActions.length > 0) {
    const attackingMoves = useMoveActions
      .map((action) => {
        const move = moveRegistry.get(action.moveId);
        return { action, power: move?.power ?? 0 };
      })
      .filter((entry) => entry.power > 0);

    if (attackingMoves.length > 0) {
      attackingMoves.sort((a, b) => b.power - a.power);
      const best = attackingMoves[0];
      if (best) {
        return best.action;
      }
    }

    const statusMoves = useMoveActions.filter((action) => {
      const move = moveRegistry.get(action.moveId);
      return move && move.power === 0;
    });
    const picked = statusMoves[Math.floor(random() * statusMoves.length)];
    if (picked) {
      return picked;
    }
  }

  const moveActions = legalActions.filter(
    (a): a is Extract<Action, { kind: typeof ActionKind.Move }> => a.kind === ActionKind.Move,
  );

  if (moveActions.length > 0 && enemies.length > 0) {
    const closestEnemy = findClosestEnemy(
      currentPokemon.position,
      enemies.map((e) => e.position),
    );
    return moveActions.reduce((best, action) => {
      const destination = action.path[action.path.length - 1] ?? currentPokemon.position;
      const bestDest = best.path[best.path.length - 1] ?? currentPokemon.position;
      return manhattanDistance(destination, closestEnemy) <
        manhattanDistance(bestDest, closestEnemy)
        ? action
        : best;
    });
  }

  const endTurnActions = legalActions.filter(
    (a): a is Extract<Action, { kind: typeof ActionKind.EndTurn }> => a.kind === ActionKind.EndTurn,
  );

  if (endTurnActions.length > 0 && enemies.length > 0) {
    const closestEnemy = findClosestEnemy(
      currentPokemon.position,
      enemies.map((e) => e.position),
    );
    const desiredDirection = directionFromTo(currentPokemon.position, closestEnemy);
    const matching = endTurnActions.find((a) => a.direction === desiredDirection);
    return matching ?? endTurnActions[0] ?? first;
  }

  return first;
}

function findClosestEnemy(from: Position, enemies: Position[]): Position {
  let closest = enemies[0] ?? from;
  let minDist = manhattanDistance(from, closest);
  for (let i = 1; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy) {
      continue;
    }
    const dist = manhattanDistance(from, enemy);
    if (dist < minDist) {
      minDist = dist;
      closest = enemy;
    }
  }
  return closest;
}
