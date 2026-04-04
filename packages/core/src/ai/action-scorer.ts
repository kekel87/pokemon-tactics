import type { BattleEngine } from "../battle/BattleEngine";
import { ActionKind } from "../enums/action-kind";
import { EffectKind } from "../enums/effect-kind";
import { EffectTarget } from "../enums/effect-target";
import { TargetingKind } from "../enums/targeting-kind";
import type { Action } from "../types/action";
import type { AiProfile } from "../types/ai-profile";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import type { TargetingPattern } from "../types/targeting-pattern";
import { directionFromTo, getPerpendicularOffsets, stepInDirection } from "../utils/direction";
import { manhattanDistance } from "../utils/manhattan-distance";

export function scoreAction(
  action: Action,
  state: BattleState,
  moveRegistry: Map<string, MoveDefinition>,
  engine: BattleEngine,
  profile: AiProfile,
): number {
  const currentPokemonId = state.turnOrder[state.currentTurnIndex];
  const currentPokemon = currentPokemonId ? state.pokemon.get(currentPokemonId) : undefined;
  if (!currentPokemon) {
    return 0;
  }

  const enemies = getAliveEnemies(state, currentPokemon);
  const allies = getAliveAllies(state, currentPokemon);

  switch (action.kind) {
    case ActionKind.UseMove:
      return scoreUseMove(action, currentPokemon, enemies, allies, moveRegistry, engine, profile);
    case ActionKind.Move:
      return scoreMove(action, currentPokemon, enemies, moveRegistry, engine, profile);
    case ActionKind.EndTurn:
      return scoreEndTurn(action, currentPokemon, enemies);
  }
}

function scoreUseMove(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  currentPokemon: PokemonInstance,
  enemies: PokemonInstance[],
  allies: PokemonInstance[],
  moveRegistry: Map<string, MoveDefinition>,
  engine: BattleEngine,
  profile: AiProfile,
): number {
  const move = moveRegistry.get(action.moveId);
  if (!move) {
    return 0;
  }

  const weights = profile.scoringWeights;
  const isSelfTargeting = move.targeting.kind === TargetingKind.Self;

  if (isSelfTargeting && move.power === 0) {
    return scoreSelfMove(currentPokemon, enemies, move, weights);
  }

  const affectedTiles = estimateAffectedTiles(
    move.targeting,
    currentPokemon.position,
    action.targetPosition,
  );
  const targetsHit = enemies.filter((enemy) => isOnTiles(enemy.position, affectedTiles));
  const alliesHit = allies.filter((ally) => isOnTiles(ally.position, affectedTiles));

  if (targetsHit.length === 0) {
    return -1;
  }

  let score = 0;

  if (move.power > 0) {
    score += scoreDamagingMove(currentPokemon, targetsHit, action.moveId, engine, weights);
  }

  if (alliesHit.length > 0) {
    score -= weights.killPotential * 0.3 * alliesHit.length;
  }

  const hasEnemyDebuff = move.effects.some(
    (effect) =>
      effect.kind === EffectKind.StatChange &&
      effect.target === EffectTarget.Target &&
      effect.stages < 0,
  );
  const hasStatus = move.effects.some((effect) => effect.kind === EffectKind.Status);

  if (hasEnemyDebuff) {
    score += weights.statChanges * 1.5;
  }
  if (hasStatus) {
    score += weights.statChanges;
  }

  return score;
}

function scoreSelfMove(
  currentPokemon: PokemonInstance,
  enemies: PokemonInstance[],
  move: MoveDefinition,
  weights: AiProfile["scoringWeights"],
): number {
  const hasSelfBuff = move.effects.some(
    (effect) =>
      effect.kind === EffectKind.StatChange &&
      effect.target === EffectTarget.Self &&
      effect.stages > 0,
  );

  if (!hasSelfBuff) {
    return 0;
  }

  const nearestEnemyDist = closestEnemyDistance(currentPokemon.position, enemies);
  return nearestEnemyDist > 2 ? weights.statChanges * 3 : weights.statChanges;
}

function scoreDamagingMove(
  currentPokemon: PokemonInstance,
  targetsHit: PokemonInstance[],
  moveId: string,
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  let totalScore = 0;

  for (const target of targetsHit) {
    const estimate = engine.estimateDamage(currentPokemon.id, moveId, target.id);
    if (!estimate) {
      continue;
    }

    let targetScore = 0;

    if (estimate.min >= target.currentHp) {
      targetScore += weights.killPotential;
    } else {
      const damageRatio = estimate.max / target.maxHp;
      targetScore += damageRatio * weights.killPotential * 0.5;
    }

    if (estimate.effectiveness > 1) {
      targetScore += weights.typeAdvantage;
    } else if (estimate.effectiveness < 1 && estimate.effectiveness > 0) {
      targetScore -= weights.typeAdvantage * 0.5;
    }

    totalScore += targetScore;
  }

  return totalScore;
}

function estimateAffectedTiles(
  targeting: TargetingPattern,
  casterPosition: Position,
  targetPosition: Position,
): Position[] {
  switch (targeting.kind) {
    case TargetingKind.Single:
      return [targetPosition];

    case TargetingKind.Self:
      return [casterPosition];

    case TargetingKind.Dash:
      return [targetPosition];

    case TargetingKind.Line: {
      const direction = directionFromTo(casterPosition, targetPosition);
      const tiles: Position[] = [];
      for (let step = 1; step <= targeting.length; step++) {
        tiles.push(stepInDirection(casterPosition, direction, step));
      }
      return tiles;
    }

    case TargetingKind.Cone: {
      const direction = directionFromTo(casterPosition, targetPosition);
      const tiles: Position[] = [];
      for (let distance = targeting.range.min; distance <= targeting.range.max; distance++) {
        const center = stepInDirection(casterPosition, direction, distance);
        tiles.push(center);
        const halfWidth = distance - 1;
        const perpOffsets = getPerpendicularOffsets(direction);
        for (let offset = 1; offset <= halfWidth; offset++) {
          for (const perp of perpOffsets) {
            tiles.push({ x: center.x + perp.x * offset, y: center.y + perp.y * offset });
          }
        }
      }
      return tiles;
    }

    case TargetingKind.Slash: {
      const direction = directionFromTo(casterPosition, targetPosition);
      const center = stepInDirection(casterPosition, direction, 1);
      const tiles = [center];
      for (const perp of getPerpendicularOffsets(direction)) {
        tiles.push({ x: center.x + perp.x, y: center.y + perp.y });
      }
      return tiles;
    }

    case TargetingKind.Cross: {
      const tiles: Position[] = [];
      const halfSize = Math.floor(targeting.size / 2);
      for (let d = -halfSize; d <= halfSize; d++) {
        tiles.push({ x: casterPosition.x + d, y: casterPosition.y });
        if (d !== 0) {
          tiles.push({ x: casterPosition.x, y: casterPosition.y + d });
        }
      }
      return tiles;
    }

    case TargetingKind.Zone:
      return tilesInRadius(casterPosition, targeting.radius);

    case TargetingKind.Blast:
      return tilesInRadius(targetPosition, targeting.radius);
  }
}

function tilesInRadius(center: Position, radius: number): Position[] {
  const tiles: Position[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (manhattanDistance(center, { x: center.x + dx, y: center.y + dy }) <= radius) {
        tiles.push({ x: center.x + dx, y: center.y + dy });
      }
    }
  }
  return tiles;
}

function isOnTiles(position: Position, tiles: Position[]): boolean {
  return tiles.some((tile) => tile.x === position.x && tile.y === position.y);
}

function scoreMove(
  action: Extract<Action, { kind: typeof ActionKind.Move }>,
  currentPokemon: PokemonInstance,
  enemies: PokemonInstance[],
  moveRegistry: Map<string, MoveDefinition>,
  engine: BattleEngine,
  profile: AiProfile,
): number {
  if (enemies.length === 0) {
    return 0;
  }

  const weights = profile.scoringWeights;
  const destination = action.path[action.path.length - 1] ?? currentPokemon.position;
  const currentDistance = closestEnemyDistance(currentPokemon.position, enemies);
  const newDistance = closestEnemyDistance(destination, enemies);
  const improvement = currentDistance - newDistance;

  let score = improvement > 0 ? improvement * weights.positioning : 0;

  const attackBonus = evaluateAttacksFromPosition(
    currentPokemon,
    destination,
    enemies,
    moveRegistry,
    engine,
    weights,
  );
  score += attackBonus;

  return score;
}

function evaluateAttacksFromPosition(
  pokemon: PokemonInstance,
  fromPosition: Position,
  enemies: PokemonInstance[],
  moveRegistry: Map<string, MoveDefinition>,
  engine: BattleEngine,
  weights: AiProfile["scoringWeights"],
): number {
  let bestAttackScore = 0;

  for (const moveId of pokemon.moveIds) {
    const move = moveRegistry.get(moveId);
    if (!move || move.power === 0) {
      continue;
    }
    if ((pokemon.currentPp[moveId] ?? 0) <= 0) {
      continue;
    }

    const reach = getMoveMaxReach(move.targeting);

    for (const enemy of enemies) {
      const dist = manhattanDistance(fromPosition, enemy.position);
      if (dist > reach) {
        continue;
      }

      const estimate = engine.estimateDamage(pokemon.id, moveId, enemy.id);
      if (!estimate) {
        continue;
      }

      let attackScore = 0;
      if (estimate.min >= enemy.currentHp) {
        attackScore = weights.killPotential;
      } else {
        attackScore = (estimate.max / enemy.maxHp) * weights.killPotential * 0.5;
      }
      if (estimate.effectiveness > 1) {
        attackScore += weights.typeAdvantage;
      }

      if (attackScore > bestAttackScore) {
        bestAttackScore = attackScore;
      }
    }
  }

  return bestAttackScore * 0.8;
}

function getMoveMaxReach(targeting: TargetingPattern): number {
  switch (targeting.kind) {
    case TargetingKind.Single:
      return targeting.range.max;
    case TargetingKind.Cone:
      return targeting.range.max;
    case TargetingKind.Line:
      return targeting.length;
    case TargetingKind.Dash:
      return targeting.maxDistance;
    case TargetingKind.Blast:
      return targeting.range.max + targeting.radius;
    case TargetingKind.Slash:
      return 1;
    case TargetingKind.Cross:
      return Math.floor(targeting.size / 2);
    case TargetingKind.Zone:
      return targeting.radius;
    case TargetingKind.Self:
      return 0;
  }
}

function scoreEndTurn(
  action: Extract<Action, { kind: typeof ActionKind.EndTurn }>,
  currentPokemon: PokemonInstance,
  enemies: PokemonInstance[],
): number {
  if (enemies.length === 0) {
    return 0;
  }

  const closestEnemy = findClosestEnemy(currentPokemon.position, enemies);
  const desiredDirection = directionFromTo(currentPokemon.position, closestEnemy);

  return action.direction === desiredDirection ? 1 : 0;
}

function getAliveEnemies(state: BattleState, currentPokemon: PokemonInstance): PokemonInstance[] {
  return [...state.pokemon.values()].filter(
    (pokemon) => pokemon.playerId !== currentPokemon.playerId && pokemon.currentHp > 0,
  );
}

function getAliveAllies(state: BattleState, currentPokemon: PokemonInstance): PokemonInstance[] {
  return [...state.pokemon.values()].filter(
    (pokemon) =>
      pokemon.playerId === currentPokemon.playerId &&
      pokemon.id !== currentPokemon.id &&
      pokemon.currentHp > 0,
  );
}

function findClosestEnemy(from: Position, enemies: PokemonInstance[]): Position {
  let closest = enemies[0]?.position ?? from;
  let minDist = manhattanDistance(from, closest);
  for (let i = 1; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy) {
      continue;
    }
    const dist = manhattanDistance(from, enemy.position);
    if (dist < minDist) {
      minDist = dist;
      closest = enemy.position;
    }
  }
  return closest;
}

function closestEnemyDistance(from: Position, enemies: PokemonInstance[]): number {
  let minDistance = Number.POSITIVE_INFINITY;
  for (const enemy of enemies) {
    const distance = manhattanDistance(from, enemy.position);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }
  return minDistance;
}
