import { AURA_RADIUS } from "../battle/aura-system";
import type { BattleEngine } from "../battle/BattleEngine";
import { isEffectivelyFlying } from "../battle/effective-flying";
import { TRANSFERABLE_STATS } from "../battle/handlers/baton-pass-stats";
import { isTerrainImmune } from "../battle/terrain-effects";
import { ActionKind } from "../enums/action-kind";
import { AuraKind } from "../enums/aura-kind";
import { EffectKind } from "../enums/effect-kind";
import { EffectTarget } from "../enums/effect-target";
import { StatusType } from "../enums/status-type";
import { TargetingKind } from "../enums/targeting-kind";
import { TerrainType } from "../enums/terrain-type";
import type { Action } from "../types/action";
import type { AiProfile } from "../types/ai-profile";
import type { BattleState } from "../types/battle-state";
import type { MoveDefinition } from "../types/move-definition";
import type { PokemonInstance } from "../types/pokemon-instance";
import type { Position } from "../types/position";
import type { TargetingPattern } from "../types/targeting-pattern";
import { directionFromTo, getPerpendicularOffsets, stepInDirection } from "../utils/direction";
import { manhattanDistance } from "../utils/manhattan-distance";
import {
  enemyHasStatDecreaseMoveInRange,
  enemyHasStatusMoveInRange,
  statusMoveRatio,
} from "./threat-detection";

const DANGEROUS_TERRAINS: ReadonlySet<TerrainType> = new Set([
  TerrainType.Magma,
  TerrainType.Lava,
  TerrainType.Swamp,
]);
const DANGEROUS_TERRAIN_PENALTY = 8;

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
      return scoreUseMove(
        action,
        currentPokemon,
        enemies,
        allies,
        moveRegistry,
        engine,
        profile,
        state,
      );
    case ActionKind.Move:
      return scoreMove(action, currentPokemon, enemies, moveRegistry, engine, profile);
    case ActionKind.EndTurn:
      return scoreEndTurn(action, currentPokemon, enemies);
    case ActionKind.UndoMove:
      return 0;
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
  state: BattleState,
): number {
  const move = moveRegistry.get(action.moveId);
  if (!move) {
    return 0;
  }

  const weights = profile.scoringWeights;
  const isSelfTargeting = move.targeting.kind === TargetingKind.Self;

  if (isSelfTargeting && move.power === 0) {
    return scoreSelfMove(currentPokemon, enemies, move, weights, state);
  }

  if (move.targetsAlly === true) {
    return scoreAllyTargetMove(action, currentPokemon, allies, move, weights);
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
      effect.target === EffectTarget.Targets &&
      effect.stages < 0,
  );
  const hasStatus = move.effects.some((effect) => effect.kind === EffectKind.Status);
  const isTauntApplication = move.effects.some(
    (effect) =>
      effect.kind === EffectKind.Status &&
      "status" in effect &&
      effect.status === StatusType.Taunted,
  );

  if (hasEnemyDebuff) {
    score += weights.statChanges * 1.5;
  }
  if (isTauntApplication) {
    score += scoreTauntApplication(targetsHit, moveRegistry, weights);
  } else if (hasStatus) {
    score += weights.statChanges;
  }

  return score;
}

function scoreTauntApplication(
  targets: readonly PokemonInstance[],
  moveRegistry: Map<string, MoveDefinition>,
  weights: AiProfile["scoringWeights"],
): number {
  let total = 0;
  for (const target of targets) {
    if (target.volatileStatuses.some((v) => v.type === StatusType.Taunted)) {
      continue;
    }
    let score = weights.statChanges;
    const ratio = statusMoveRatio(target, moveRegistry);
    if (ratio >= 0.4) {
      score *= 1.8;
    }
    const hpRatio = target.currentHp / target.maxHp;
    if (hpRatio < 0.3) {
      score *= 0.3;
    }
    total += score;
  }
  return total;
}

function scoreAllyTargetMove(
  action: Extract<Action, { kind: typeof ActionKind.UseMove }>,
  currentPokemon: PokemonInstance,
  allies: PokemonInstance[],
  move: MoveDefinition,
  weights: AiProfile["scoringWeights"],
): number {
  const target = allies.find(
    (ally) =>
      ally.position.x === action.targetPosition.x && ally.position.y === action.targetPosition.y,
  );
  if (!target) {
    return -1;
  }

  const hasTransfer = move.effects.some((effect) => effect.kind === EffectKind.TransferStatStages);
  if (!hasTransfer) {
    return 0;
  }

  let casterPositive = 0;
  let casterNegative = 0;
  let targetPositive = 0;
  for (const stat of TRANSFERABLE_STATS) {
    const cs = currentPokemon.statStages[stat];
    const ts = target.statStages[stat];
    if (cs > 0) {
      casterPositive += cs;
    } else {
      casterNegative += cs;
    }
    if (ts > 0) {
      targetPositive += ts;
    }
  }

  if (casterPositive === 0) {
    return -20;
  }

  let score = casterPositive * 4 + casterNegative * 2;
  if (targetPositive < casterPositive) {
    score += 8;
  }
  return score * (weights.statChanges / 10 + 1);
}

function scoreSelfMove(
  currentPokemon: PokemonInstance,
  enemies: PokemonInstance[],
  move: MoveDefinition,
  weights: AiProfile["scoringWeights"],
  state?: BattleState,
): number {
  const hasSelfBuff = move.effects.some(
    (effect) =>
      effect.kind === EffectKind.StatChange &&
      effect.target === EffectTarget.Self &&
      effect.stages > 0,
  );

  const postAuraEffect = move.effects.find(
    (effect): effect is Extract<typeof effect, { kind: typeof EffectKind.PostAura }> =>
      effect.kind === EffectKind.PostAura,
  );
  if (postAuraEffect) {
    if (!state) {
      return weights.statChanges;
    }
    const alreadyHasSameKind = state.auras.some(
      (aura) => aura.casterPokemonId === currentPokemon.id && aura.kind === postAuraEffect.aura,
    );
    if (alreadyHasSameKind) {
      return -1;
    }
    let alliesInRadius = 0;
    for (const candidate of state.pokemon.values()) {
      if (candidate.currentHp <= 0 || candidate.playerId !== currentPokemon.playerId) {
        continue;
      }
      if (candidate.id === currentPokemon.id) {
        continue;
      }
      const dx = Math.abs(candidate.position.x - currentPokemon.position.x);
      const dy = Math.abs(candidate.position.y - currentPokemon.position.y);
      if (dx + dy <= AURA_RADIUS) {
        alliesInRadius += 1;
      }
    }
    const earlyMultiplier = state.roundNumber <= 3 ? 2 : 1;

    let threatBonus = 1.0;
    if (postAuraEffect.aura === AuraKind.Mist) {
      threatBonus = enemyHasStatDecreaseMoveInRange(enemies, currentPokemon, 5) ? 1.5 : 1.0;
    } else if (postAuraEffect.aura === AuraKind.Safeguard) {
      threatBonus = enemyHasStatusMoveInRange(enemies, currentPokemon, 5) ? 1.5 : 1.0;
    }

    return weights.statChanges * earlyMultiplier * (1 + alliesInRadius) * threatBonus;
  }

  const hasPostSubstitute = move.effects.some(
    (effect) => effect.kind === EffectKind.PostSubstitute,
  );
  if (hasPostSubstitute) {
    if (currentPokemon.substituteHp !== undefined) {
      return -1;
    }
    const hpRatio = currentPokemon.currentHp / currentPokemon.maxHp;
    if (hpRatio <= 0.25) {
      return 0;
    }
    let multiplier = 1.0;
    if (
      enemyHasStatusMoveInRange(enemies, currentPokemon, 5) ||
      enemyHasStatDecreaseMoveInRange(enemies, currentPokemon, 5)
    ) {
      multiplier *= 1.5;
    }
    if (state && state.roundNumber <= 3) {
      multiplier *= 1.2;
    }
    if (hpRatio < 0.4) {
      multiplier *= 0.5;
    }
    return weights.statChanges * 1.5 * multiplier;
  }

  if (!hasSelfBuff) {
    return 0;
  }

  const nearestEnemyDist = closestEnemyManhattanDistance(currentPokemon.position, enemies);
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

    case TargetingKind.Teleport:
      return [targetPosition];

    case TargetingKind.HitAndRun:
      return [targetPosition];
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
  const currentDistance = closestDistanceToEnemies(
    currentPokemon.position,
    enemies,
    currentPokemon.id,
    engine,
  );
  const newDistance = closestDistanceToEnemies(destination, enemies, currentPokemon.id, engine);
  const improvement = currentDistance - newDistance;

  let score = improvement > 0 ? improvement * weights.positioning : 0;

  const pokemonTypes = engine.getPokemonTypes(currentPokemon.id);
  const isFlying = isEffectivelyFlying(currentPokemon, pokemonTypes);
  const destinationTile = action.path.length > 0 ? engine.getTileAt(destination) : null;
  if (
    destinationTile &&
    DANGEROUS_TERRAINS.has(destinationTile.terrain) &&
    !isTerrainImmune(destinationTile.terrain, pokemonTypes, isFlying)
  ) {
    score -= DANGEROUS_TERRAIN_PENALTY;
  }

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
    case TargetingKind.Teleport:
      return targeting.range.max;
    case TargetingKind.HitAndRun:
      return targeting.hitRange.max;
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

function closestEnemyManhattanDistance(from: Position, enemies: PokemonInstance[]): number {
  let minDistance = Number.POSITIVE_INFINITY;
  for (const enemy of enemies) {
    const distance = manhattanDistance(from, enemy.position);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }
  return minDistance;
}

function closestDistanceToEnemies(
  from: Position,
  enemies: PokemonInstance[],
  pokemonId: string,
  engine: BattleEngine,
): number {
  let minDistance = Number.POSITIVE_INFINITY;
  for (const enemy of enemies) {
    const pathDist = engine.computePathDistance(from, enemy.position, pokemonId);
    const dist =
      pathDist === Number.POSITIVE_INFINITY ? manhattanDistance(from, enemy.position) : pathDist;
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
}
